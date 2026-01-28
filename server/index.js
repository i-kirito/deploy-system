import express from 'express';
import cors from 'cors';
import initSqlJs from 'sql.js';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3030;
const DB_PATH = path.join(__dirname, 'deploy.db');

// 中间件
app.use(cors());
app.use(express.json());

// 静态文件服务 - 禁用缓存
app.use(express.static(path.join(__dirname, '../web/dist'), {
  etag: false,
  lastModified: false,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
}));

// ===================== 数据库初始化 =====================
let db;

async function initDatabase() {
  const SQL = await initSqlJs();

  // 尝试加载现有数据库
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
    console.log('已加载现有数据库');
  } else {
    db = new SQL.Database();
    console.log('创建新数据库');
  }

  // 创建表
  db.run(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 谷歌账号池 - 包含完整账号信息
  db.run(`
    CREATE TABLE IF NOT EXISTS google_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      recovery_email TEXT,
      totp_secret TEXT,
      is_used INTEGER DEFAULT 0,
      assigned_key_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 检查并添加新字段（兼容旧数据库）
  try {
    db.run(`ALTER TABLE google_accounts ADD COLUMN password TEXT DEFAULT ''`);
  } catch (e) { /* 字段已存在 */ }
  try {
    db.run(`ALTER TABLE google_accounts ADD COLUMN recovery_email TEXT DEFAULT ''`);
  } catch (e) { /* 字段已存在 */ }
  try {
    db.run(`ALTER TABLE google_accounts ADD COLUMN totp_secret TEXT DEFAULT ''`);
  } catch (e) { /* 字段已存在 */ }
  // 新增：账号绑定的订单ID，用于判断账号是否被分配
  try {
    db.run(`ALTER TABLE google_accounts ADD COLUMN assigned_order_id TEXT DEFAULT NULL`);
  } catch (e) { /* 字段已存在 */ }
  // 新增：排序字段
  try {
    db.run(`ALTER TABLE google_accounts ADD COLUMN sort_order INTEGER DEFAULT 0`);
  } catch (e) { /* 字段已存在 */ }
  // 初始化排序值（如果为0则设置为id）
  db.run(`UPDATE google_accounts SET sort_order = id WHERE sort_order = 0 OR sort_order IS NULL`);

  // 删除旧的 refresh_token 字段的依赖（如果存在）
  // 新结构不再需要 refresh_token，因为是完整的账号信息

  db.run(`
    CREATE TABLE IF NOT EXISTS deploy_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key_code TEXT UNIQUE NOT NULL,
      key_type TEXT NOT NULL,
      google_email TEXT,
      google_password TEXT,
      google_recovery_email TEXT,
      google_totp_secret TEXT,
      price INTEGER NOT NULL,
      is_paid INTEGER DEFAULT 0,
      is_used INTEGER DEFAULT 0,
      order_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      paid_at DATETIME,
      used_at DATETIME
    )
  `);

  // 检查并添加新字段
  try {
    db.run(`ALTER TABLE deploy_keys ADD COLUMN google_password TEXT DEFAULT ''`);
  } catch (e) { /* 字段已存在 */ }
  try {
    db.run(`ALTER TABLE deploy_keys ADD COLUMN google_recovery_email TEXT DEFAULT ''`);
  } catch (e) { /* 字段已存在 */ }
  try {
    db.run(`ALTER TABLE deploy_keys ADD COLUMN google_totp_secret TEXT DEFAULT ''`);
  } catch (e) { /* 字段已存在 */ }

  // 添加 contact_email 字段到 orders 表
  try {
    db.run(`ALTER TABLE orders ADD COLUMN contact_email TEXT DEFAULT ''`);
  } catch (e) { /* 字段已存在 */ }

  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT UNIQUE NOT NULL,
      key_id INTEGER,
      amount INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      paid_at DATETIME
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  // 初始化默认管理员账户
  const adminResult = db.exec("SELECT id FROM admins WHERE username = 'admin'");
  if (adminResult.length === 0 || adminResult[0].values.length === 0) {
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    db.run("INSERT INTO admins (username, password) VALUES (?, ?)", ['admin', hashedPassword]);
    console.log('默认管理员账户已创建: admin / admin123');
  }

  // 初始化默认配置
  const defaultConfig = {
    'alipay_qrcode': '',
    'price_builtin': '60',
    'price_custom': '50',
    'download_url': ''
  };

  for (const [key, value] of Object.entries(defaultConfig)) {
    const result = db.exec(`SELECT key FROM config WHERE key = '${key}'`);
    if (result.length === 0 || result[0].values.length === 0) {
      db.run("INSERT INTO config (key, value) VALUES (?, ?)", [key, value]);
    }
  }

  saveDatabase();
}

// 保存数据库到文件
function saveDatabase() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

// ===================== 工具函数 =====================

function generateKeyCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 12; i++) {
    if (i > 0 && i % 4 === 0) result += '-';
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateOrderId() {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `ORD${dateStr}${random}`;
}

function getConfig(key) {
  const result = db.exec(`SELECT value FROM config WHERE key = '${key}'`);
  if (result.length > 0 && result[0].values.length > 0) {
    return result[0].values[0][0];
  }
  return null;
}

function queryOne(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

function queryAll(sql, params = []) {
  // 如果有参数，使用 prepared statement
  if (params.length > 0) {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  }
  // 无参数时使用 exec
  const result = db.exec(sql);
  if (result.length === 0) return [];
  const columns = result[0].columns;
  return result[0].values.map(row => {
    const obj = {};
    columns.forEach((col, i) => obj[col] = row[i]);
    return obj;
  });
}

function runQuery(sql, params = []) {
  db.run(sql, params);
  // 在保存数据库之前获取 last_insert_rowid
  const lastId = db.exec("SELECT last_insert_rowid()")[0]?.values[0]?.[0];
  saveDatabase();
  return { lastInsertRowid: lastId };
}

// ===================== API 路由 =====================

app.get('/api/prices', (req, res) => {
  // 获取可用账号数量（库存）
  const availableAccounts = db.exec('SELECT COUNT(*) FROM google_accounts WHERE assigned_order_id IS NULL')[0]?.values[0]?.[0] || 0;

  res.json({
    builtin: parseInt(getConfig('price_builtin')) || 60,
    custom: parseInt(getConfig('price_custom')) || 50,
    builtinStock: availableAccounts
  });
});

app.post('/api/order/builtin', (req, res) => {
  const { contactEmail } = req.body;

  try {
    // 查询可用账号：assigned_order_id 为空表示可用
    const accounts = queryAll("SELECT * FROM google_accounts WHERE assigned_order_id IS NULL ORDER BY id LIMIT 1");
    const availableAccount = accounts[0];

    if (!availableAccount) {
      return res.status(400).json({ error: '暂无可用账号，请稍后再试' });
    }

    const keyCode = generateKeyCode();
    const orderId = generateOrderId();
    const price = parseInt(getConfig('price_builtin')) || 60;

    const keyResult = runQuery(
      `INSERT INTO deploy_keys (key_code, key_type, google_email, google_password, google_recovery_email, google_totp_secret, price, order_id)
       VALUES (?, 'builtin', ?, ?, ?, ?, ?, ?)`,
      [keyCode, availableAccount.email, availableAccount.password, availableAccount.recovery_email, availableAccount.totp_secret, price, orderId]
    );

    const keyId = keyResult.lastInsertRowid;

    runQuery(
      `INSERT INTO orders (order_id, key_id, amount, status, contact_email) VALUES (?, ?, ?, 'pending', ?)`,
      [orderId, keyId, price, contactEmail || '']
    );

    // 查询订单的创建时间
    const orderResult = queryAll(`SELECT created_at FROM orders WHERE order_id = ?`, [orderId]);
    const createdAt = orderResult[0]?.created_at;

    // 绑定账号到订单：设置 assigned_order_id
    runQuery('UPDATE google_accounts SET assigned_order_id = ? WHERE id = ?', [orderId, availableAccount.id]);

    res.json({
      success: true,
      orderId,
      amount: price,
      qrcodeUrl: getConfig('alipay_qrcode'),
      createdAt: createdAt // 返回数据库的创建时间
    });
  } catch (error) {
    console.error('创建订单失败:', error);
    res.status(500).json({ error: '创建订单失败' });
  }
});

app.post('/api/order/custom', (req, res) => {
  try {
    const { email, password, recoveryEmail, totpSecret, contactEmail } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: '请提供谷歌账号邮箱和密码' });
    }

    const keyCode = generateKeyCode();
    const orderId = generateOrderId();
    const price = parseInt(getConfig('price_custom')) || 50;

    const keyResult = runQuery(
      `INSERT INTO deploy_keys (key_code, key_type, google_email, google_password, google_recovery_email, google_totp_secret, price, order_id)
       VALUES (?, 'custom', ?, ?, ?, ?, ?, ?)`,
      [keyCode, email, password, recoveryEmail || '', totpSecret || '', price, orderId]
    );

    const keyId = keyResult.lastInsertRowid;

    runQuery(
      `INSERT INTO orders (order_id, key_id, amount, status, contact_email) VALUES (?, ?, ?, 'pending', ?)`,
      [orderId, keyId, price, contactEmail || '']
    );

    // 查询订单的创建时间
    const orderResult = queryAll(`SELECT created_at FROM orders WHERE order_id = ?`, [orderId]);
    const createdAt = orderResult[0]?.created_at;

    res.json({
      success: true,
      orderId,
      amount: price,
      qrcodeUrl: getConfig('alipay_qrcode'),
      createdAt: createdAt // 返回数据库的创建时间
    });
  } catch (error) {
    console.error('创建订单失败:', error);
    res.status(500).json({ error: '创建订单失败' });
  }
});

app.get('/api/order/:orderId', (req, res) => {
  const { orderId } = req.params;

  const orders = queryAll(`
    SELECT o.*, k.key_code, k.is_used
    FROM orders o
    LEFT JOIN deploy_keys k ON o.key_id = k.id
    WHERE o.order_id = '${orderId}'
  `);

  if (orders.length === 0) {
    return res.status(404).json({ error: '订单不存在' });
  }

  const order = orders[0];
  res.json({
    orderId: order.order_id,
    amount: order.amount,
    status: order.status,
    keyCode: order.status === 'paid' ? order.key_code : null,
    isUsed: order.is_used === 1
  });
});

// 用户取消订单（仅限待支付订单）
app.post('/api/order/:orderId/cancel', (req, res) => {
  const { orderId } = req.params;

  try {
    // 查找订单
    const orders = queryAll(`
      SELECT o.*, k.id as key_id, k.key_type, k.google_email
      FROM orders o
      LEFT JOIN deploy_keys k ON o.key_id = k.id
      WHERE o.order_id = '${orderId}'
    `);

    if (orders.length === 0) {
      return res.status(404).json({ error: '订单不存在' });
    }

    const order = orders[0];

    // 只能取消待支付的订单
    if (order.status !== 'pending') {
      return res.status(400).json({ error: '只能取消待支付的订单' });
    }

    // 释放绑定的账号
    runQuery('UPDATE google_accounts SET assigned_order_id = NULL WHERE assigned_order_id = ?', [orderId]);

    // 删除密钥
    if (order.key_id) {
      runQuery('DELETE FROM deploy_keys WHERE id = ?', [order.key_id]);
    }

    // 删除订单
    runQuery('DELETE FROM orders WHERE order_id = ?', [orderId]);

    res.json({ success: true, message: '订单已取消' });
  } catch (error) {
    console.error('取消订单失败:', error);
    res.status(500).json({ error: '取消订单失败' });
  }
});

app.post('/api/key/verify', (req, res) => {
  const { keyCode } = req.body;

  if (!keyCode) {
    return res.status(400).json({ error: '请提供密钥' });
  }

  const cleanKey = keyCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const formattedKey = cleanKey.replace(/(.{4})/g, '$1-').slice(0, -1);

  const keys = queryAll(`SELECT * FROM deploy_keys WHERE key_code = '${formattedKey}' AND is_paid = 1`);

  if (keys.length === 0) {
    return res.status(404).json({ error: '密钥无效或未支付' });
  }

  const key = keys[0];
  if (key.is_used === 1) {
    return res.status(400).json({ error: '密钥已被使用' });
  }

  // 返回完整的谷歌账号信息
  res.json({
    valid: true,
    email: key.google_email,
    password: key.google_password,
    recoveryEmail: key.google_recovery_email,
    totpSecret: key.google_totp_secret,
    keyType: key.key_type
  });
});

app.post('/api/key/consume', (req, res) => {
  const { keyCode } = req.body;

  if (!keyCode) {
    return res.status(400).json({ error: '请提供密钥' });
  }

  const cleanKey = keyCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const formattedKey = cleanKey.replace(/(.{4})/g, '$1-').slice(0, -1);

  runQuery(
    `UPDATE deploy_keys SET is_used = 1, used_at = datetime('now') WHERE key_code = ? AND is_paid = 1 AND is_used = 0`,
    [formattedKey]
  );

  const key = queryOne(`SELECT * FROM deploy_keys WHERE key_code = '${formattedKey}'`);
  if (key && key.key_type === 'builtin') {
    runQuery('UPDATE google_accounts SET is_used = 1 WHERE email = ?', [key.google_email]);
  }

  res.json({ success: true, message: '密钥已消耗' });
});

// 通过密钥查询订单详情（用户端）
app.post('/api/key/query', (req, res) => {
  const { keyCode } = req.body;

  if (!keyCode) {
    return res.status(400).json({ error: '请提供密钥' });
  }

  const cleanKey = keyCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const formattedKey = cleanKey.replace(/(.{4})/g, '$1-').slice(0, -1);

  // 查询密钥和关联的订单
  const results = queryAll(`
    SELECT k.*, o.order_id, o.amount, o.status, o.created_at, o.contact_email
    FROM deploy_keys k
    LEFT JOIN orders o ON k.id = o.key_id
    WHERE k.key_code = ?
  `, [formattedKey]);

  if (results.length === 0) {
    return res.status(404).json({ error: '密钥不存在' });
  }

  const data = results[0];

  res.json({
    orderId: data.order_id,
    keyCode: data.key_code,
    keyType: data.key_type,
    amount: data.amount,
    status: data.status,
    isUsed: data.is_used === 1,
    createdAt: data.created_at,
    contactEmail: data.contact_email
  });
});

// 通过邮箱查询订单列表
app.post('/api/order/query-by-email', (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: '请提供邮箱' });
  }

  // 查询该邮箱关联的所有订单
  const results = queryAll(`
    SELECT o.*, k.key_code, k.key_type, k.is_used
    FROM orders o
    LEFT JOIN deploy_keys k ON o.key_id = k.id
    WHERE o.contact_email = ?
    ORDER BY o.created_at DESC
  `, [email]);

  res.json(results.map(order => ({
    orderId: order.order_id,
    keyCode: order.status === 'paid' ? order.key_code : null,
    keyType: order.key_type,
    amount: order.amount,
    status: order.status,
    isUsed: order.is_used === 1,
    createdAt: order.created_at
  })));
});

// ===================== 管理后台 API =====================

app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;

  const admins = queryAll(`SELECT * FROM admins WHERE username = '${username}'`);

  if (admins.length === 0 || !bcrypt.compareSync(password, admins[0].password)) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }

  const token = Buffer.from(`${username}:${Date.now()}`).toString('base64');
  res.json({ success: true, token });
});

function adminAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: '未授权' });
  }
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const [username] = decoded.split(':');
    const admins = queryAll(`SELECT id FROM admins WHERE username = '${username}'`);
    if (admins.length === 0) {
      return res.status(401).json({ error: '未授权' });
    }
    next();
  } catch {
    return res.status(401).json({ error: '未授权' });
  }
}

app.post('/api/admin/order/confirm', adminAuth, (req, res) => {
  const { orderId } = req.body;

  const orders = queryAll(`SELECT * FROM orders WHERE order_id = '${orderId}'`);
  if (orders.length === 0) {
    return res.status(404).json({ error: '订单不存在' });
  }

  if (orders[0].status === 'paid') {
    return res.status(400).json({ error: '订单已确认' });
  }

  runQuery(`UPDATE orders SET status = 'paid', paid_at = datetime('now') WHERE order_id = ?`, [orderId]);
  runQuery(`UPDATE deploy_keys SET is_paid = 1, paid_at = datetime('now') WHERE order_id = ?`, [orderId]);

  const keys = queryAll(`SELECT key_code FROM deploy_keys WHERE order_id = '${orderId}'`);
  res.json({ success: true, keyCode: keys[0]?.key_code });
});

app.get('/api/admin/orders', adminAuth, (req, res) => {
  const orders = queryAll(`
    SELECT o.*, k.key_code, k.key_type, k.google_email, k.is_used
    FROM orders o
    LEFT JOIN deploy_keys k ON o.key_id = k.id
    ORDER BY o.created_at DESC
    LIMIT 100
  `);
  res.json(orders);
});

// 添加账号 - 支持完整信息
app.post('/api/admin/accounts', adminAuth, (req, res) => {
  const { email, password, recoveryEmail, totpSecret } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: '请提供谷歌账号邮箱和密码' });
  }

  try {
    runQuery(
      `INSERT INTO google_accounts (email, password, recovery_email, totp_secret) VALUES (?, ?, ?, ?)`,
      [email, password, recoveryEmail || '', totpSecret || '']
    );
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: '账号已存在或添加失败' });
  }
});

// 批量添加账号
app.post('/api/admin/accounts/batch', adminAuth, (req, res) => {
  const { accounts } = req.body;

  if (!accounts || !Array.isArray(accounts)) {
    return res.status(400).json({ error: '请提供账号列表' });
  }

  let successCount = 0;
  let failCount = 0;

  for (const account of accounts) {
    try {
      runQuery(
        `INSERT INTO google_accounts (email, password, recovery_email, totp_secret) VALUES (?, ?, ?, ?)`,
        [account.email, account.password, account.recoveryEmail || '', account.totpSecret || '']
      );
      successCount++;
    } catch (error) {
      failCount++;
    }
  }

  res.json({ success: true, successCount, failCount });
});

app.get('/api/admin/accounts', adminAuth, (req, res) => {
  const accounts = queryAll(`
    SELECT id, email, password, recovery_email, totp_secret, assigned_order_id, sort_order, created_at
    FROM google_accounts
    ORDER BY sort_order ASC, id ASC
  `);
  res.json(accounts);
});

app.delete('/api/admin/accounts/:id', adminAuth, (req, res) => {
  const { id } = req.params;
  // 只能删除未绑定订单的账号
  runQuery('DELETE FROM google_accounts WHERE id = ? AND assigned_order_id IS NULL', [parseInt(id)]);
  res.json({ success: true });
});

// 更新账号信息
app.put('/api/admin/accounts/:id', adminAuth, (req, res) => {
  const { id } = req.params;
  const { email, password, recoveryEmail, totpSecret } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: '邮箱和密码不能为空' });
  }

  try {
    runQuery(
      `UPDATE google_accounts SET email = ?, password = ?, recovery_email = ?, totp_secret = ? WHERE id = ?`,
      [email, password, recoveryEmail || '', totpSecret || '', parseInt(id)]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: '更新失败，邮箱可能已存在' });
  }
});

// 手动释放账号（清空订单绑定）
app.post('/api/admin/accounts/:id/release', adminAuth, (req, res) => {
  const { id } = req.params;
  runQuery('UPDATE google_accounts SET assigned_order_id = NULL WHERE id = ?', [parseInt(id)]);
  res.json({ success: true, message: '账号已释放' });
});

// 切换账号可用状态（手动标记为可用/不可用）
app.post('/api/admin/accounts/:id/toggle-status', adminAuth, (req, res) => {
  const { id } = req.params;
  const accounts = queryAll('SELECT assigned_order_id FROM google_accounts WHERE id = ?', [parseInt(id)]);

  if (accounts.length === 0) {
    return res.status(404).json({ error: '账号不存在' });
  }

  const account = accounts[0];
  // 如果当前可用（assigned_order_id 为空），则标记为不可用（设置为 'DISABLED'）
  // 如果当前不可用，则标记为可用（清空 assigned_order_id）
  if (account.assigned_order_id === null || account.assigned_order_id === '') {
    runQuery('UPDATE google_accounts SET assigned_order_id = ? WHERE id = ?', ['DISABLED', parseInt(id)]);
    res.json({ success: true, status: 'disabled', message: '账号已标记为不可用' });
  } else {
    runQuery('UPDATE google_accounts SET assigned_order_id = NULL WHERE id = ?', [parseInt(id)]);
    res.json({ success: true, status: 'available', message: '账号已标记为可用' });
  }
});

// 更新账号排序
app.post('/api/admin/accounts/reorder', adminAuth, (req, res) => {
  const { orders } = req.body; // [{ id: 1, sort_order: 0 }, { id: 2, sort_order: 1 }, ...]

  if (!Array.isArray(orders)) {
    return res.status(400).json({ error: '参数格式错误' });
  }

  try {
    for (const item of orders) {
      runQuery('UPDATE google_accounts SET sort_order = ? WHERE id = ?', [item.sort_order, item.id]);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: '更新排序失败' });
  }
});

// 删除订单
app.delete('/api/admin/orders/:orderId', adminAuth, (req, res) => {
  const { orderId } = req.params;

  try {
    // 查找订单和关联的密钥
    const orders = queryAll(`
      SELECT o.*, k.id as key_id, k.key_type, k.google_email, k.is_used
      FROM orders o
      LEFT JOIN deploy_keys k ON o.key_id = k.id
      WHERE o.order_id = '${orderId}'
    `);

    if (orders.length === 0) {
      return res.status(404).json({ error: '订单不存在' });
    }

    const order = orders[0];

    // 删除订单时，无条件释放绑定的账号（清空 assigned_order_id）
    runQuery('UPDATE google_accounts SET assigned_order_id = NULL WHERE assigned_order_id = ?', [orderId]);

    // 删除密钥
    if (order.key_id) {
      runQuery('DELETE FROM deploy_keys WHERE id = ?', [order.key_id]);
    }

    // 删除订单
    runQuery('DELETE FROM orders WHERE order_id = ?', [orderId]);

    res.json({ success: true, message: '订单已删除' });
  } catch (error) {
    console.error('删除订单失败:', error);
    res.status(500).json({ error: '删除订单失败' });
  }
});

app.post('/api/admin/config', adminAuth, (req, res) => {
  const updates = req.body;
  for (const [key, value] of Object.entries(updates)) {
    runQuery('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)', [key, value]);
  }
  res.json({ success: true });
});

app.get('/api/admin/config', adminAuth, (req, res) => {
  const rows = queryAll('SELECT * FROM config');
  const config = {};
  for (const row of rows) {
    config[row.key] = row.value;
  }
  res.json(config);
});

// 修改管理员密码
app.post('/api/admin/password', adminAuth, (req, res) => {
  const { oldPassword, newPassword, newUsername } = req.body;

  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: '请提供旧密码和新密码' });
  }

  const admins = queryAll('SELECT * FROM admins LIMIT 1');
  const admin = admins[0];

  if (!admin || !bcrypt.compareSync(oldPassword, admin.password)) {
    return res.status(401).json({ error: '旧密码错误' });
  }

  const hashedPassword = bcrypt.hashSync(newPassword, 10);

  if (newUsername && newUsername !== admin.username) {
    runQuery('UPDATE admins SET username = ?, password = ? WHERE id = ?', [newUsername, hashedPassword, admin.id]);
  } else {
    runQuery('UPDATE admins SET password = ? WHERE id = ?', [hashedPassword, admin.id]);
  }

  res.json({ success: true, message: '密码修改成功，请重新登录' });
});

app.get('/api/admin/stats', adminAuth, (req, res) => {
  const totalOrders = db.exec('SELECT COUNT(*) FROM orders')[0]?.values[0]?.[0] || 0;
  const paidOrders = db.exec("SELECT COUNT(*) FROM orders WHERE status = 'paid'")[0]?.values[0]?.[0] || 0;
  const usedKeys = db.exec('SELECT COUNT(*) FROM deploy_keys WHERE is_used = 1')[0]?.values[0]?.[0] || 0;
  // 可用账号：assigned_order_id 为空
  const availableAccounts = db.exec('SELECT COUNT(*) FROM google_accounts WHERE assigned_order_id IS NULL')[0]?.values[0]?.[0] || 0;
  const totalRevenue = db.exec("SELECT COALESCE(SUM(amount), 0) FROM orders WHERE status = 'paid'")[0]?.values[0]?.[0] || 0;

  res.json({
    totalOrders,
    paidOrders,
    usedKeys,
    availableAccounts,
    totalRevenue
  });
});

// 管理员测试密钥生成 - 无需支付，使用自定义测试账号
app.post('/api/admin/test-key', adminAuth, (req, res) => {
  const { email, password, recoveryEmail, totpSecret } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: '请提供测试账号邮箱和密码' });
  }

  try {
    const keyCode = generateKeyCode();
    const orderId = 'TEST' + Date.now();

    // 创建测试密钥，标记为已支付
    const keyResult = runQuery(
      `INSERT INTO deploy_keys (key_code, key_type, google_email, google_password, google_recovery_email, google_totp_secret, price, order_id, is_paid)
       VALUES (?, 'test', ?, ?, ?, ?, 0, ?, 1)`,
      [keyCode, email, password, recoveryEmail || '', totpSecret || '', orderId]
    );

    const keyId = keyResult.lastInsertRowid;

    // 创建测试订单，直接标记为已支付
    runQuery(
      `INSERT INTO orders (order_id, key_id, amount, status) VALUES (?, ?, 0, 'paid')`,
      [orderId, keyId]
    );

    res.json({
      success: true,
      keyCode,
      orderId,
      message: '测试密钥生成成功'
    });
  } catch (error) {
    console.error('生成测试密钥失败:', error);
    res.status(500).json({ error: '生成测试密钥失败' });
  }
});

// 带密钥验证的下载接口 - 动态生成包含账号信息的包
app.get('/api/download/:keyCode', async (req, res) => {
  const { keyCode } = req.params;

  if (!keyCode) {
    return res.status(400).json({ error: '请提供密钥' });
  }

  const cleanKey = keyCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const formattedKey = cleanKey.replace(/(.{4})/g, '$1-').slice(0, -1);

  const keys = queryAll(`SELECT * FROM deploy_keys WHERE key_code = '${formattedKey}' AND is_paid = 1`);

  if (keys.length === 0) {
    return res.status(404).json({ error: '密钥无效或未支付' });
  }

  const key = keys[0];
  if (key.is_used === 1) {
    return res.status(400).json({ error: '密钥已被使用' });
  }

  // 基础包路径
  const baseZipPath = path.join(__dirname, 'cliproxyapi.zip');
  if (!fs.existsSync(baseZipPath)) {
    return res.status(404).json({ error: '文件不存在' });
  }

  // 生成包含账号信息的启动脚本
  const accountInfo = {
    email: key.google_email || '',
    password: key.google_password || '',
    recoveryEmail: key.google_recovery_email || '',
    totpSecret: key.google_totp_secret || ''
  };

  // 创建临时目录
  const tempDir = path.join(__dirname, 'temp', formattedKey);
  const tempZipPath = path.join(__dirname, 'temp', `${formattedKey}.zip`);

  try {
    // 确保临时目录存在
    fs.mkdirSync(path.join(__dirname, 'temp'), { recursive: true });

    // 解压原始包
    const AdmZip = (await import('adm-zip')).default;
    const zip = new AdmZip(baseZipPath);
    zip.extractAllTo(tempDir, true);

    // 删除原始的中文名 bat 文件
    const cliproxyDir = path.join(tempDir, 'cliproxyapi');
    const files = fs.readdirSync(cliproxyDir);
    for (const file of files) {
      if (file.endsWith('.bat')) {
        fs.unlinkSync(path.join(cliproxyDir, file));
      }
    }

    // 生成新的启动脚本，包含账号信息
    const totpSecret = accountInfo.totpSecret ? accountInfo.totpSecret.replace(/[\s-]/g, '').toUpperCase() : '';

    // 使用纯 ASCII 的 bat 脚本，避免编码问题
    const safeEmail = accountInfo.email || '(none)';
    const safePassword = accountInfo.password || '(none)';
    const safeRecovery = accountInfo.recoveryEmail || '(none)';
    const safe2FA = totpSecret ? 'Configured' : '(none)';

    const launchScript = `@echo off
cd /d "%~dp0"
title CLIProxyAPI Deploy

echo ============================================
echo    CLIProxyAPI Deploy
echo ============================================
echo.

set "EXE_NAME=cli-proxy-api.exe"
if not exist "%EXE_NAME%" (
    echo Error: %EXE_NAME% not found
    pause
    exit /b 1
)

echo Starting service...
start "" "%EXE_NAME%"
ping -n 4 127.0.0.1 >nul 2>&1

echo.
echo ============================================
echo    Google Account Info
echo ============================================
echo.
echo   Email:    ${safeEmail}
echo   Password: ${safePassword}
echo   Recovery: ${safeRecovery}
echo   2FA:      ${safe2FA}
echo.
echo ============================================
echo    CLIProxyAPI
echo ============================================
echo.
echo   Web:      http://127.0.0.1:8317/management.html
echo   Password: admin123
echo.
echo ============================================
start http://127.0.0.1:8317/management.html
${totpSecret ? `
echo.
echo ============================================
echo    2FA Code (Auto Refresh)
echo ============================================
powershell -ExecutionPolicy Bypass -File "totp.ps1" 2>nul
` : `
echo.
echo Press any key to exit...
pause >nul
`}
`;

    // 写入启动脚本 (纯 ASCII，无 BOM)
    const scriptPath = path.join(tempDir, 'cliproxyapi', 'start.bat');
    fs.writeFileSync(scriptPath, launchScript, 'latin1');

    // 如果有 2FA，生成单独的 PowerShell 脚本
    if (totpSecret) {
      const totpPs1 = `# TOTP Code Generator
$secret = "${totpSecret}"

function Get-TOTP {
    param([string]$Secret)

    $base32chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
    $bits = ""
    foreach ($char in $Secret.ToCharArray()) {
        $idx = $base32chars.IndexOf($char)
        if ($idx -ge 0) {
            $bits += [Convert]::ToString($idx, 2).PadLeft(5, '0')
        }
    }
    $bytes = @()
    for ($i = 0; $i -lt $bits.Length; $i += 8) {
        if ($i + 8 -le $bits.Length) {
            $bytes += [Convert]::ToByte($bits.Substring($i, 8), 2)
        }
    }
    $keyBytes = [byte[]]$bytes

    $epoch = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
    $counter = [Math]::Floor($epoch / 30)
    $remaining = 30 - ($epoch % 30)

    $counterBytes = [byte[]]@(0,0,0,0,0,0,0,0)
    $c = $counter
    for ($i = 7; $i -ge 0; $i--) {
        $counterBytes[$i] = [byte]($c -band 0xFF)
        $c = [Math]::Floor($c / 256)
    }

    $hmac = New-Object System.Security.Cryptography.HMACSHA1
    $hmac.Key = $keyBytes
    $hash = $hmac.ComputeHash($counterBytes)

    $offset = $hash[19] -band 0x0F
    $code = (($hash[$offset] -band 0x7F) * 16777216) + (($hash[$offset + 1] -band 0xFF) * 65536) + (($hash[$offset + 2] -band 0xFF) * 256) + ($hash[$offset + 3] -band 0xFF)
    $otp = $code % 1000000

    return @{Code = $otp.ToString("D6"); Remaining = [int]$remaining}
}

Write-Host ""
Write-Host "  2FA Code Generator - Press Ctrl+C to exit" -ForegroundColor Gray
Write-Host ""

while ($true) {
    try {
        $result = Get-TOTP -Secret $secret
        $bar = "=" * $result.Remaining + "-" * (30 - $result.Remaining)
        $line = "  Code: " + $result.Code + "  [" + $bar + "] " + $result.Remaining.ToString().PadLeft(2) + "s"

        [Console]::SetCursorPosition(0, [Console]::CursorTop)
        Write-Host $line -NoNewline -ForegroundColor Green

        Start-Sleep -Seconds 1
    } catch {
        Write-Host ""
        Write-Host "  Error calculating 2FA code" -ForegroundColor Red
        break
    }
}
`;
      const totpPath = path.join(tempDir, 'cliproxyapi', 'totp.ps1');
      fs.writeFileSync(totpPath, totpPs1, 'utf8');
    }

    // 重新打包
    const newZip = new AdmZip();
    newZip.addLocalFolder(path.join(tempDir, 'cliproxyapi'), 'cliproxyapi');
    newZip.writeZip(tempZipPath);

    // 发送文件
    res.download(tempZipPath, 'cliproxyapi.zip', (err) => {
      // 清理临时文件
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
        fs.unlinkSync(tempZipPath);
      } catch (e) {
        console.error('清理临时文件失败:', e);
      }
    });
  } catch (error) {
    console.error('生成下载包失败:', error);
    // 清理临时文件
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
      if (fs.existsSync(tempZipPath)) fs.unlinkSync(tempZipPath);
    } catch (e) {}

    // 回退到原始包
    res.download(baseZipPath, 'cliproxyapi.zip');
  }
});

// SPA 回退
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../web/dist/index.html'));
});

// 清理过期未支付订单（10分钟）
function cleanExpiredOrders() {
  // SQLite CURRENT_TIMESTAMP 格式: 'YYYY-MM-DD HH:MM:SS'
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);

  // 查找过期的待支付订单
  const expiredOrders = queryAll(`
    SELECT o.order_id, o.key_id
    FROM orders o
    WHERE o.status = 'pending' AND o.created_at < '${tenMinutesAgo}'
  `);

  if (expiredOrders.length > 0) {
    console.log(`清理 ${expiredOrders.length} 个过期订单...`);

    for (const order of expiredOrders) {
      // 释放绑定的账号
      runQuery('UPDATE google_accounts SET assigned_order_id = NULL WHERE assigned_order_id = ?', [order.order_id]);

      // 删除密钥
      if (order.key_id) {
        runQuery('DELETE FROM deploy_keys WHERE id = ?', [order.key_id]);
      }

      // 删除订单
      runQuery('DELETE FROM orders WHERE order_id = ?', [order.order_id]);
    }

    console.log('过期订单清理完成');
  }
}

// 启动服务器
initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
    console.log('管理后台: http://localhost:' + PORT + '/admin');

    // 每分钟检查一次过期订单
    setInterval(cleanExpiredOrders, 60 * 1000);
    // 启动时也检查一次
    cleanExpiredOrders();
  });
});
