<template>
  <div class="container">
    <!-- Toast 提示 -->
    <div v-if="toastMessage" class="toast">{{ toastMessage }}</div>

    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
      <h1>管理后台</h1>
      <div style="display: flex; gap: 12px;">
        <button class="btn" style="background: var(--bg-input);" @click="router.push('/')">返回首页</button>
        <button class="btn btn-danger" @click="logout">退出登录</button>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">{{ stats.totalOrders }}</div>
        <div class="stat-label">总订单数</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.paidOrders }}</div>
        <div class="stat-label">已支付订单</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.usedKeys }}</div>
        <div class="stat-label">已使用密钥</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.availableAccounts }}</div>
        <div class="stat-label">可用账号</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">¥{{ stats.totalRevenue }}</div>
        <div class="stat-label">总收入</div>
      </div>
    </div>

    <!-- 导航标签 -->
    <div class="admin-nav">
      <button :class="{ active: activeTab === 'orders' }" @click="activeTab = 'orders'">
        订单管理
      </button>
      <button :class="{ active: activeTab === 'accounts' }" @click="activeTab = 'accounts'">
        账号池管理
      </button>
      <button :class="{ active: activeTab === 'config' }" @click="activeTab = 'config'">
        系统配置
      </button>
      <button :class="{ active: activeTab === 'test' }" @click="activeTab = 'test'">
        测试密钥
      </button>
      <button :class="{ active: activeTab === 'password' }" @click="activeTab = 'password'">
        修改密码
      </button>
    </div>

    <!-- 订单管理 -->
    <div v-if="activeTab === 'orders'" class="card">
      <h2 class="card-title">订单列表</h2>

      <div style="overflow-x: auto;">
        <table class="table">
          <thead>
            <tr>
              <th>订单号</th>
              <th>类型</th>
              <th>金额</th>
              <th>邮箱</th>
              <th>密钥</th>
              <th>状态</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="order in orders" :key="order.order_id">
              <td>{{ order.order_id }}</td>
              <td>{{ order.key_type === 'builtin' ? '内置账号' : '自有账号' }}</td>
              <td>¥{{ order.amount }}</td>
              <td>{{ order.contact_email || '-' }}</td>
              <td style="font-family: monospace;">{{ order.key_code || '-' }}</td>
              <td>
                <span v-if="order.is_used" class="status-badge status-used">已使用</span>
                <span v-else-if="order.status === 'paid'" class="status-badge status-paid">已支付</span>
                <template v-else>
                  <span v-if="getOrderCountdown(order.created_at) > 0" class="status-badge status-pending">
                    待支付 {{ formatCountdown(getOrderCountdown(order.created_at)) }}
                  </span>
                  <span v-else class="status-badge status-expired">已过期</span>
                </template>
              </td>
              <td>{{ formatDate(order.created_at) }}</td>
              <td>
                <div style="display: flex; gap: 8px;">
                  <button
                    v-if="order.status === 'pending'"
                    class="btn btn-success"
                    style="padding: 6px 12px; font-size: 0.85rem;"
                    @click="confirmOrder(order.order_id)"
                  >
                    确认支付
                  </button>
                  <button
                    class="btn btn-danger"
                    style="padding: 6px 12px; font-size: 0.85rem;"
                    @click="deleteOrder(order.order_id)"
                  >
                    删除
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="orders.length === 0" style="text-align: center; padding: 40px; color: var(--text-muted);">
        暂无订单
      </div>
    </div>

    <!-- 账号池管理 -->
    <div v-if="activeTab === 'accounts'" class="card">
      <h2 class="card-title">内置账号池 (Gemini CLI / 反重力认证)</h2>

      <!-- 单个添加 -->
      <div style="margin-bottom: 20px; padding: 20px; background: var(--bg-input); border-radius: 12px;">
        <h3 style="margin-bottom: 12px; font-size: 1rem;">添加新账号</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">谷歌邮箱</label>
            <input type="email" class="input" v-model="newAccount.email" placeholder="example@gmail.com" />
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">密码</label>
            <input type="text" class="input" v-model="newAccount.password" placeholder="谷歌密码" />
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">辅助邮箱</label>
            <input type="email" class="input" v-model="newAccount.recoveryEmail" placeholder="recovery@example.com" />
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">2FA密钥/应用密码</label>
            <input type="text" class="input" v-model="newAccount.totpSecret" placeholder="TOTP密钥或应用专用密码" />
          </div>
        </div>
        <button class="btn btn-primary" style="margin-top: 12px;" @click="addAccount">添加账号</button>
      </div>

      <!-- 批量添加 -->
      <div style="margin-bottom: 20px; padding: 20px; background: var(--bg-input); border-radius: 12px;">
        <h3 style="margin-bottom: 12px; font-size: 1rem;">批量添加 (格式: 邮箱|密码|辅助邮箱|2FA密钥，每行一个)</h3>
        <textarea
          class="textarea"
          v-model="batchInput"
          placeholder="example1@gmail.com|password1|recovery1@example.com|totp_secret1
example2@gmail.com|password2|recovery2@example.com|totp_secret2"
          style="min-height: 120px;"
        ></textarea>
        <button class="btn btn-primary" style="margin-top: 12px;" @click="batchAddAccounts">批量添加</button>
      </div>

      <!-- 账号列表 - 卡片式布局 -->
      <div class="accounts-grid">
        <div v-for="account in accounts" :key="account.id" class="account-card">
          <div class="account-header">
            <div class="account-id">#{{ account.id }}</div>
            <span
              v-if="account.assigned_order_id === 'DISABLED'"
              class="status-badge status-disabled"
              @click="toggleAccountStatus(account.id)"
              style="cursor: pointer;"
              title="点击切换为可用"
            >
              <span class="status-dot"></span>已禁用
            </span>
            <span
              v-else-if="account.assigned_order_id"
              class="status-badge status-assigned"
            >
              <span class="status-dot"></span>已分配
            </span>
            <span
              v-else
              class="status-badge status-available"
              @click="toggleAccountStatus(account.id)"
              style="cursor: pointer;"
              title="点击切换为不可用"
            >
              <span class="status-dot"></span>可用
            </span>
          </div>

          <div class="account-email copyable" @click="copyText(account.email)" title="点击复制">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
            {{ account.email }}
          </div>

          <div class="account-details">
            <div class="detail-row">
              <span class="detail-label">密码</span>
              <span class="detail-value copyable" @click="copyText(account.password)" title="点击复制">
                {{ maskPassword(account.password) }}
              </span>
            </div>
            <div class="detail-row" v-if="account.recovery_email">
              <span class="detail-label">辅助邮箱</span>
              <span class="detail-value copyable" @click="copyText(account.recovery_email)" title="点击复制">
                {{ account.recovery_email }}
              </span>
            </div>
            <div class="detail-row" v-if="account.totp_secret">
              <span class="detail-label">2FA</span>
              <span class="detail-value" style="font-family: monospace; font-size: 0.75rem;">
                {{ account.totp_secret.substring(0, 16) }}{{ account.totp_secret.length > 16 ? '...' : '' }}
              </span>
            </div>
            <div class="detail-row">
              <span class="detail-label">添加时间</span>
              <span class="detail-value">{{ formatDate(account.created_at) }}</span>
            </div>
          </div>

          <div class="account-actions">
            <button
              class="btn-action btn-edit"
              @click="openEditModal(account)"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              编辑
            </button>
            <button
              v-if="account.assigned_order_id"
              class="btn-action btn-release"
              @click="releaseAccount(account.id)"
              :title="'关联订单: ' + account.assigned_order_id"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
              释放
            </button>
            <button
              v-if="!account.assigned_order_id"
              class="btn-action btn-delete"
              @click="deleteAccount(account.id)"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
              删除
            </button>
          </div>
        </div>
      </div>

      <!-- 编辑账号弹窗 -->
      <div v-if="editingAccount" class="modal-overlay" @click.self="editingAccount = null">
        <div class="modal">
          <h3 class="modal-title">编辑账号 #{{ editingAccount.id }}</h3>

          <div class="form-group">
            <label class="form-label">谷歌邮箱</label>
            <input type="email" class="input" v-model="editingAccount.email" placeholder="example@gmail.com" />
          </div>

          <div class="form-group">
            <label class="form-label">密码</label>
            <input type="text" class="input" v-model="editingAccount.password" placeholder="谷歌密码" />
          </div>

          <div class="form-group">
            <label class="form-label">辅助邮箱</label>
            <input type="email" class="input" v-model="editingAccount.recovery_email" placeholder="recovery@example.com" />
          </div>

          <div class="form-group">
            <label class="form-label">2FA密钥/应用密码</label>
            <input type="text" class="input" v-model="editingAccount.totp_secret" placeholder="TOTP密钥或应用专用密码" />
          </div>

          <div style="display: flex; gap: 12px; margin-top: 20px;">
            <button class="btn" style="flex: 1; background: var(--bg-input);" @click="editingAccount = null">
              取消
            </button>
            <button class="btn btn-primary" style="flex: 1;" @click="saveAccount" :disabled="!editingAccount.email || !editingAccount.password">
              保存
            </button>
          </div>
        </div>
      </div>

      <div v-if="accounts.length === 0" style="text-align: center; padding: 40px; color: var(--text-muted);">
        暂无账号，请先添加
      </div>
    </div>

    <!-- 系统配置 -->
    <div v-if="activeTab === 'config'" class="card">
      <h2 class="card-title">系统配置</h2>

      <div class="form-group">
        <label class="form-label">支付宝收款码图片URL</label>
        <input type="text" class="input" v-model="config.alipay_qrcode" placeholder="https://example.com/qrcode.png" />
      </div>

      <div class="form-group">
        <label class="form-label">内置账号价格 (元)</label>
        <input type="number" class="input" v-model="config.price_builtin" />
      </div>

      <div class="form-group">
        <label class="form-label">自有账号价格 (元)</label>
        <input type="number" class="input" v-model="config.price_custom" />
      </div>

      <div class="form-group">
        <label class="form-label">部署脚本下载地址</label>
        <input type="text" class="input" v-model="config.download_url" placeholder="https://example.com/deploy-script.zip" />
      </div>

      <button class="btn btn-primary" @click="saveConfig">保存配置</button>
    </div>

    <!-- 测试密钥 -->
    <div v-if="activeTab === 'test'" class="card">
      <h2 class="card-title">生成测试密钥</h2>
      <p style="color: var(--text-muted); margin-bottom: 20px;">
        无需支付，使用自定义测试账号直接生成可用密钥。测试账号信息不会存入账号池。
      </p>

      <div class="form-group">
        <label class="form-label">测试账号邮箱 <span style="color: var(--danger);">*</span></label>
        <input type="email" class="input" v-model="testAccount.email" placeholder="test@gmail.com" />
      </div>

      <div class="form-group">
        <label class="form-label">测试账号密码 <span style="color: var(--danger);">*</span></label>
        <input type="text" class="input" v-model="testAccount.password" placeholder="测试账号密码" />
      </div>

      <div class="form-group">
        <label class="form-label">辅助邮箱 (可选)</label>
        <input type="email" class="input" v-model="testAccount.recoveryEmail" placeholder="recovery@example.com" />
      </div>

      <div class="form-group">
        <label class="form-label">2FA密钥/应用密码 (可选)</label>
        <input type="text" class="input" v-model="testAccount.totpSecret" placeholder="TOTP密钥或应用专用密码" />
      </div>

      <button
        class="btn btn-success"
        @click="generateTestKey"
        :disabled="testKeyLoading || !testAccount.email || !testAccount.password"
      >
        {{ testKeyLoading ? '生成中...' : '生成测试密钥' }}
      </button>

      <!-- 生成结果 -->
      <div v-if="generatedTestKey" class="test-key-result" style="margin-top: 20px; padding: 20px; background: var(--bg-input); border-radius: 12px;">
        <h3 style="color: var(--success); margin-bottom: 12px;">测试密钥生成成功</h3>
        <div style="margin-bottom: 12px;">
          <span style="color: var(--text-muted);">订单号：</span>
          <span style="font-family: monospace;">{{ generatedTestKey.orderId }}</span>
        </div>
        <div style="margin-bottom: 16px;">
          <span style="color: var(--text-muted);">密钥：</span>
          <span style="font-family: monospace; font-size: 1.2rem; color: var(--primary); font-weight: 600;">{{ generatedTestKey.keyCode }}</span>
        </div>
        <button class="btn btn-primary" @click="copyTestKey">复制密钥</button>
      </div>
    </div>

    <!-- 修改密码 -->
    <div v-if="activeTab === 'password'" class="card">
      <h2 class="card-title">修改管理员账号密码</h2>

      <div class="form-group">
        <label class="form-label">新用户名 (可选，不填则保持不变)</label>
        <input type="text" class="input" v-model="passwordForm.newUsername" placeholder="admin" />
      </div>

      <div class="form-group">
        <label class="form-label">旧密码</label>
        <input type="password" class="input" v-model="passwordForm.oldPassword" placeholder="请输入当前密码" />
      </div>

      <div class="form-group">
        <label class="form-label">新密码</label>
        <input type="password" class="input" v-model="passwordForm.newPassword" placeholder="请输入新密码" />
      </div>

      <div class="form-group">
        <label class="form-label">确认新密码</label>
        <input type="password" class="input" v-model="passwordForm.confirmPassword" placeholder="请再次输入新密码" />
      </div>

      <button class="btn btn-primary" @click="changePassword">修改密码</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'

const router = useRouter()
const activeTab = ref('orders')
const toastMessage = ref('')
const stats = ref({
  totalOrders: 0,
  paidOrders: 0,
  usedKeys: 0,
  availableAccounts: 0,
  totalRevenue: 0
})
const orders = ref([])
const accounts = ref([])
const config = ref({
  alipay_qrcode: '',
  price_builtin: '60',
  price_custom: '50',
  download_url: ''
})
const editingAccount = ref(null)
const newAccount = ref({ email: '', password: '', recoveryEmail: '', totpSecret: '' })
const batchInput = ref('')
const passwordForm = ref({ oldPassword: '', newPassword: '', confirmPassword: '', newUsername: '' })
const testAccount = ref({ email: '', password: '', recoveryEmail: '', totpSecret: '' })
const testKeyLoading = ref(false)
const generatedTestKey = ref(null)
const now = ref(Date.now()) // 用于触发倒计时更新
let countdownTimer = null

// axios 拦截器添加 token
axios.interceptors.request.use(reqConfig => {
  const token = localStorage.getItem('adminToken')
  if (token) {
    reqConfig.headers.Authorization = `Bearer ${token}`
  }
  return reqConfig
})

onMounted(async () => {
  await Promise.all([
    loadStats(),
    loadOrders(),
    loadAccounts(),
    loadConfig()
  ])
  // 启动倒计时更新器
  countdownTimer = setInterval(() => {
    now.value = Date.now()
  }, 1000)
})

onUnmounted(() => {
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
})

// 计算订单剩余时间（秒）
function getOrderCountdown(createdAt) {
  // SQLite CURRENT_TIMESTAMP 返回的是 UTC 时间，需要加 'Z' 后缀
  const created = new Date(createdAt + 'Z').getTime()
  const expireTime = created + 10 * 60 * 1000 // 10分钟后过期
  const remaining = Math.floor((expireTime - now.value) / 1000)
  return Math.max(0, remaining)
}

// 格式化倒计时显示
function formatCountdown(seconds) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

async function loadStats() {
  try {
    const { data } = await axios.get('/api/admin/stats')
    stats.value = data
  } catch (e) {
    console.error('加载统计失败', e)
  }
}

async function loadOrders() {
  try {
    const { data } = await axios.get('/api/admin/orders')
    orders.value = data
  } catch (e) {
    console.error('加载订单失败', e)
  }
}

async function loadAccounts() {
  try {
    const { data } = await axios.get('/api/admin/accounts')
    accounts.value = data
  } catch (e) {
    console.error('加载账号失败', e)
  }
}

async function loadConfig() {
  try {
    const { data } = await axios.get('/api/admin/config')
    config.value = { ...config.value, ...data }
  } catch (e) {
    console.error('加载配置失败', e)
  }
}

async function confirmOrder(orderId) {
  if (!confirm('确认该订单已收款？')) return

  try {
    const { data } = await axios.post('/api/admin/order/confirm', { orderId })
    alert(`订单已确认，密钥: ${data.keyCode}`)
    await Promise.all([loadStats(), loadOrders()])
  } catch (e) {
    alert(e.response?.data?.error || '确认失败')
  }
}

async function deleteOrder(orderId) {
  if (!confirm('确认删除该订单？如果绑定了内置账号且未使用，账号将被释放。')) return

  try {
    await axios.delete(`/api/admin/orders/${orderId}`)
    await Promise.all([loadStats(), loadOrders(), loadAccounts()])
    alert('订单已删除')
  } catch (e) {
    alert(e.response?.data?.error || '删除失败')
  }
}

async function addAccount() {
  if (!newAccount.value.email || !newAccount.value.password) {
    alert('请填写邮箱和密码')
    return
  }

  try {
    await axios.post('/api/admin/accounts', newAccount.value)
    newAccount.value = { email: '', password: '', recoveryEmail: '', totpSecret: '' }
    await Promise.all([loadStats(), loadAccounts()])
    alert('添加成功')
  } catch (e) {
    alert(e.response?.data?.error || '添加失败')
  }
}

async function batchAddAccounts() {
  if (!batchInput.value.trim()) {
    alert('请输入账号信息')
    return
  }

  const lines = batchInput.value.trim().split('\n')
  const accounts = []

  for (const line of lines) {
    // 支持 | 和 --- 两种分隔符
    const separator = line.includes('---') ? '---' : '|'
    const parts = line.split(separator)
    if (parts.length >= 2) {
      accounts.push({
        email: parts[0].trim(),
        password: parts[1].trim(),
        recoveryEmail: parts[2]?.trim() || '',
        totpSecret: parts[3]?.trim() || ''
      })
    }
  }

  if (accounts.length === 0) {
    alert('未识别到有效账号')
    return
  }

  try {
    const { data } = await axios.post('/api/admin/accounts/batch', { accounts })
    batchInput.value = ''
    await Promise.all([loadStats(), loadAccounts()])
    alert(`添加完成！成功: ${data.successCount}, 失败: ${data.failCount}`)
  } catch (e) {
    alert(e.response?.data?.error || '批量添加失败')
  }
}

async function deleteAccount(id) {
  if (!confirm('确认删除该账号？')) return

  try {
    await axios.delete(`/api/admin/accounts/${id}`)
    await Promise.all([loadStats(), loadAccounts()])
  } catch (e) {
    alert('删除失败')
  }
}

async function releaseAccount(id) {
  if (!confirm('确认释放该账号？将重置为可用状态。')) return

  try {
    await axios.post(`/api/admin/accounts/${id}/release`)
    await Promise.all([loadStats(), loadAccounts()])
    showToast('账号已释放')
  } catch (e) {
    alert('释放失败')
  }
}

async function toggleAccountStatus(id) {
  try {
    const { data } = await axios.post(`/api/admin/accounts/${id}/toggle-status`)
    await Promise.all([loadStats(), loadAccounts()])
    showToast(data.message)
  } catch (e) {
    alert(e.response?.data?.error || '切换状态失败')
  }
}

function openEditModal(account) {
  editingAccount.value = { ...account }
}

async function saveAccount() {
  if (!editingAccount.value) return

  try {
    const payload = {
      email: editingAccount.value.email,
      password: editingAccount.value.password,
      recoveryEmail: editingAccount.value.recovery_email || '',
      totpSecret: editingAccount.value.totp_secret || ''
    }
    await axios.put(`/api/admin/accounts/${editingAccount.value.id}`, payload)
    editingAccount.value = null
    await loadAccounts()
    showToast('账号已更新')
  } catch (e) {
    console.error('保存账号失败:', e)
    alert(e.response?.data?.error || '保存失败: ' + (e.message || '未知错误'))
  }
}

async function saveConfig() {
  try {
    await axios.post('/api/admin/config', config.value)
    alert('配置已保存')
  } catch (e) {
    alert('保存失败')
  }
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('zh-CN')
}

function maskPassword(password) {
  if (!password) return '-'
  if (password.length <= 4) return '****'
  return password.substring(0, 2) + '****' + password.substring(password.length - 2)
}

async function copyText(text) {
  if (!text) return
  try {
    // 优先使用 Clipboard API
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
    } else {
      // 回退方案：使用 execCommand
      const textArea = document.createElement('textarea')
      textArea.value = text
      textArea.style.position = 'fixed'
      textArea.style.left = '-9999px'
      textArea.style.top = '-9999px'
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
    }
    showToast('已复制到剪贴板')
  } catch (err) {
    console.error('复制失败:', err)
    showToast('复制失败，请手动复制')
  }
}

function showToast(message) {
  toastMessage.value = message
  setTimeout(() => {
    toastMessage.value = ''
  }, 1500)
}

function logout() {
  localStorage.removeItem('adminToken')
  router.push('/admin/login')
}

async function changePassword() {
  if (!passwordForm.value.oldPassword || !passwordForm.value.newPassword) {
    alert('请填写旧密码和新密码')
    return
  }

  if (passwordForm.value.newPassword !== passwordForm.value.confirmPassword) {
    alert('两次输入的新密码不一致')
    return
  }

  if (passwordForm.value.newPassword.length < 6) {
    alert('新密码长度至少6位')
    return
  }

  try {
    await axios.post('/api/admin/password', {
      oldPassword: passwordForm.value.oldPassword,
      newPassword: passwordForm.value.newPassword,
      newUsername: passwordForm.value.newUsername || undefined
    })
    alert('密码修改成功，请重新登录')
    localStorage.removeItem('adminToken')
    router.push('/admin/login')
  } catch (e) {
    alert(e.response?.data?.error || '修改失败')
  }
}

async function generateTestKey() {
  if (!testAccount.value.email || !testAccount.value.password) {
    alert('请填写测试账号邮箱和密码')
    return
  }

  testKeyLoading.value = true
  generatedTestKey.value = null

  try {
    const { data } = await axios.post('/api/admin/test-key', testAccount.value)
    generatedTestKey.value = {
      keyCode: data.keyCode,
      orderId: data.orderId
    }
    await loadStats()
  } catch (e) {
    alert(e.response?.data?.error || '生成测试密钥失败')
  } finally {
    testKeyLoading.value = false
  }
}

function copyTestKey() {
  if (generatedTestKey.value) {
    navigator.clipboard.writeText(generatedTestKey.value.keyCode)
    alert('密钥已复制到剪贴板')
  }
}
</script>

<style scoped>
/* 账号池卡片式布局 */
.accounts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
  margin-top: 20px;
}

.account-card {
  background: var(--bg-input);
  border-radius: 12px;
  padding: 16px;
  border: 1px solid var(--border);
  transition: all 0.3s ease;
}

.account-card:hover {
  border-color: var(--primary);
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
}

.account-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.account-id {
  font-size: 0.8rem;
  color: var(--text-muted);
  font-weight: 600;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 8px;
  font-size: 0.8rem;
  font-weight: 600;
  min-width: 80px;
  text-align: center;
}

/* 待支付状态 */
.status-pending {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: white;
  box-shadow: 0 2px 8px rgba(245, 158, 11, 0.3);
  animation: pendingPulse 2s ease-in-out infinite;
}

@keyframes pendingPulse {
  0%, 100% { box-shadow: 0 2px 8px rgba(245, 158, 11, 0.3); }
  50% { box-shadow: 0 4px 16px rgba(245, 158, 11, 0.5); }
}

/* 已支付状态 */
.status-paid {
  background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
  color: white;
  box-shadow: 0 2px 8px rgba(34, 197, 94, 0.3);
}

/* 已使用状态 */
.status-used {
  background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
  color: white;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
}

/* 已过期状态 */
.status-expired {
  background: linear-gradient(135deg, #64748b 0%, #475569 100%);
  color: white;
  box-shadow: 0 2px 8px rgba(100, 116, 139, 0.3);
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  animation: pulse 2s infinite;
}

.status-available {
  background: rgba(34, 197, 94, 0.15);
  color: var(--success);
}

.status-available .status-dot {
  background: var(--success);
}

.status-assigned {
  background: rgba(148, 163, 184, 0.15);
  color: var(--text-muted);
}

.status-assigned .status-dot {
  background: var(--text-muted);
  animation: none;
}

.status-disabled {
  background: rgba(239, 68, 68, 0.15);
  color: var(--danger);
  transition: all 0.2s ease;
}

.status-disabled:hover {
  background: rgba(239, 68, 68, 0.25);
}

.status-disabled .status-dot {
  background: var(--danger);
  animation: none;
}

.status-available {
  transition: all 0.2s ease;
}

.status-available:hover {
  background: rgba(34, 197, 94, 0.25);
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.account-email {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.95rem;
  font-weight: 500;
  color: var(--text);
  padding: 10px 12px;
  background: var(--bg-card);
  border-radius: 8px;
  margin-bottom: 12px;
  word-break: break-all;
}

.account-email svg {
  flex-shrink: 0;
  color: var(--text-muted);
}

.account-details {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.85rem;
}

.detail-label {
  color: var(--text-muted);
}

.detail-value {
  color: var(--text);
  text-align: right;
  max-width: 60%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.account-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}

.btn-action {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 12px;
  border: none;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-release {
  background: rgba(245, 158, 11, 0.15);
  color: var(--warning);
}

.btn-release:hover {
  background: var(--warning);
  color: #1a1a2e;
}

.btn-delete {
  background: rgba(239, 68, 68, 0.15);
  color: var(--danger);
}

.btn-delete:hover {
  background: var(--danger);
  color: white;
}

.btn-edit {
  background: rgba(99, 102, 241, 0.15);
  color: var(--primary);
}

.btn-edit:hover {
  background: var(--primary);
  color: white;
}

/* 点击复制效果 */
.copyable {
  cursor: pointer;
  transition: all 0.2s ease;
}

.copyable:hover {
  color: var(--primary);
  background: rgba(99, 102, 241, 0.1);
  border-radius: 4px;
}

.copyable:active {
  transform: scale(0.98);
}

/* 模态框样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.modal {
  background: var(--bg-card);
  border-radius: 16px;
  padding: 24px;
  width: 90%;
  max-width: 480px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  animation: modalIn 0.3s ease;
}

@keyframes modalIn {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.modal-title {
  margin-bottom: 20px;
  font-size: 1.2rem;
  color: var(--text);
}

/* Toast 提示样式 */
.toast {
  position: fixed;
  top: auto;
  bottom: 30px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--primary);
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 0.9rem;
  z-index: 2000;
  animation: toastIn 0.3s ease;
  box-shadow: 0 4px 20px rgba(99, 102, 241, 0.4);
}

@keyframes toastIn {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

@media (max-width: 640px) {
  .accounts-grid {
    grid-template-columns: 1fr;
  }
}
</style>
