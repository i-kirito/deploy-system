# CLIProxyAPI 一键部署系统

付费自动部署 CLIProxyAPI 的完整解决方案。

## 系统架构

```
deploy-system/
├── server/           # 后端服务 (Express + SQLite)
│   ├── index.js      # 主程序
│   ├── package.json
│   └── deploy.db     # 数据库 (运行后自动生成)
├── web/              # 前端 (Vue 3)
│   ├── src/
│   │   ├── views/
│   │   │   ├── Home.vue       # 用户购买页面
│   │   │   ├── Order.vue      # 订单查询页面
│   │   │   ├── Admin.vue      # 管理后台
│   │   │   └── AdminLogin.vue # 管理员登录
│   │   └── ...
│   └── package.json
└── scripts/          # 部署脚本
    ├── deploy-windows.ps1   # Windows PowerShell 脚本
    ├── 一键部署.bat          # Windows 启动器
    └── deploy.sh            # Linux/macOS 脚本
```

## 快速开始

### 1. 安装依赖

```bash
# 后端
cd deploy-system/server
pnpm install

# 前端
cd ../web
pnpm install
```

### 2. 构建前端

```bash
cd deploy-system/web
pnpm build
```

### 3. 启动服务

```bash
cd deploy-system/server
pnpm start
```

服务默认运行在 `http://localhost:3000`

### 4. 配置系统

1. 访问 `http://localhost:3000/admin/login`
2. 默认账号: `admin` / 密码: `admin123`
3. 在管理后台配置:
   - 支付宝收款码图片 URL
   - 价格设置
   - 添加内置谷歌账号

## 功能说明

### 用户端

1. **选择方案**
   - 内置账号 (60元): 系统自动分配谷歌账号
   - 自有账号 (50元): 使用用户自己的谷歌账号

2. **支付流程**
   - 扫描支付宝二维码支付
   - 备注订单号
   - 管理员确认后自动生成密钥

3. **获取密钥**
   - 密钥格式: XXXX-XXXX-XXXX
   - 一次性使用，部署成功后失效

### 管理端

- **订单管理**: 查看订单、手动确认支付
- **账号池管理**: 添加/删除内置谷歌账号
- **系统配置**: 设置收款码、价格等

### 部署脚本

1. **Windows**: 运行 `一键部署.bat`
2. **Linux/macOS**: 运行 `bash deploy.sh`

脚本功能:
- 验证密钥有效性
- 下载 CLIProxyAPI 最新版本
- 自动配置 OAuth 凭据
- 部署成功后自动销毁

## API 接口

### 公开接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/prices` | 获取价格信息 |
| POST | `/api/order/builtin` | 创建内置账号订单 |
| POST | `/api/order/custom` | 创建自有账号订单 |
| GET | `/api/order/:orderId` | 查询订单状态 |
| POST | `/api/key/verify` | 验证密钥 (脚本调用) |
| POST | `/api/key/consume` | 消耗密钥 (脚本调用) |

### 管理接口 (需认证)

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/admin/login` | 管理员登录 |
| GET | `/api/admin/stats` | 获取统计信息 |
| GET | `/api/admin/orders` | 获取订单列表 |
| POST | `/api/admin/order/confirm` | 确认订单支付 |
| GET | `/api/admin/accounts` | 获取账号列表 |
| POST | `/api/admin/accounts` | 添加账号 |
| DELETE | `/api/admin/accounts/:id` | 删除账号 |
| GET | `/api/admin/config` | 获取配置 |
| POST | `/api/admin/config` | 更新配置 |

## 部署到生产环境

### 修改配置

1. 编辑 `scripts/deploy-windows.ps1` 和 `scripts/deploy.sh`
2. 将 `$API_SERVER` / `API_SERVER` 改为实际服务器地址

### 使用 PM2 运行

```bash
npm install -g pm2
cd deploy-system/server
pm2 start index.js --name deploy-system
pm2 save
```

### Nginx 反向代理

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 安全建议

1. 修改默认管理员密码
2. 使用 HTTPS
3. 定期备份数据库
4. 限制管理接口访问 IP

## License

MIT
