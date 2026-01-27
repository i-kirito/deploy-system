<template>
  <div class="container">
    <div class="header">
      <h1>CLIProxyAPI 一键部署</h1>
      <p>快速部署您的 AI 代理服务，支持 Claude Code / Gemini CLI / Codex</p>
      <div style="display: flex; gap: 12px; justify-content: center; margin-top: 16px;">
        <router-link to="/query" class="admin-link">密钥查询</router-link>
        <router-link to="/admin" class="admin-link">管理后台</router-link>
      </div>
    </div>

    <!-- 步骤指示器 -->
    <div class="step-indicator">
      <div class="step" :class="{ active: step === 1, completed: step > 1 }">
        <div class="step-number">{{ step > 1 ? '✓' : '1' }}</div>
        <div class="step-label">选择方案</div>
      </div>
      <div class="step" :class="{ active: step === 2, completed: step > 2 }">
        <div class="step-number">{{ step > 2 ? '✓' : '2' }}</div>
        <div class="step-label">填写信息</div>
      </div>
      <div class="step" :class="{ active: step === 3, completed: step > 3 }">
        <div class="step-number">{{ step > 3 ? '✓' : '3' }}</div>
        <div class="step-label">扫码支付</div>
      </div>
      <div class="step" :class="{ active: step === 4 }">
        <div class="step-number">4</div>
        <div class="step-label">获取密钥</div>
      </div>
    </div>

    <!-- 步骤 1: 选择方案 -->
    <div v-if="step === 1">
      <div class="price-cards">
        <div
          class="price-card"
          :class="{ selected: selectedPlan === 'builtin' }"
          @click="selectPlan('builtin')"
        >
          <div class="tag">推荐</div>
          <h3>内置账号</h3>
          <div class="price">¥{{ prices.builtin }}<span>/次</span></div>
          <p class="desc">无需谷歌账号，系统自动分配<br>快速上手，即买即用</p>
          <div class="stock-info" :class="{ 'stock-low': prices.builtinStock <= 3, 'stock-out': prices.builtinStock === 0 }">
            库存: {{ prices.builtinStock }} 个
          </div>
        </div>

        <div
          class="price-card"
          :class="{ selected: selectedPlan === 'custom' }"
          @click="selectPlan('custom')"
        >
          <h3>自有账号</h3>
          <div class="price">¥{{ prices.custom }}<span>/次</span></div>
          <p class="desc">使用您自己的谷歌账号<br>更灵活，可自行管理</p>
        </div>
      </div>

      <button class="btn btn-primary btn-block" @click="nextStep" :disabled="!selectedPlan">
        下一步
      </button>
    </div>

    <!-- 步骤 2: 填写信息 -->
    <div v-if="step === 2" class="card">
      <h2 class="card-title">填写信息</h2>

      <!-- 联系邮箱（所有方案都需要填写） -->
      <div class="form-group">
        <label class="form-label">联系邮箱 <span style="color: var(--danger);">*</span></label>
        <input
          type="email"
          class="input"
          v-model="contactEmail"
          placeholder="用于接收订单通知"
        />
        <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 8px;">
          订单状态变更时将发送通知到此邮箱
        </p>
      </div>

      <div v-if="selectedPlan === 'custom'">
        <div class="form-group">
          <label class="form-label">谷歌账号邮箱 <span style="color: var(--danger);">*</span></label>
          <input
            type="email"
            class="input"
            v-model="customEmail"
            placeholder="your-email@gmail.com"
          />
        </div>

        <div class="form-group">
          <label class="form-label">谷歌密码 <span style="color: var(--danger);">*</span></label>
          <input
            type="password"
            class="input"
            v-model="customPassword"
            placeholder="请输入谷歌账号密码"
          />
        </div>

        <div class="form-group">
          <label class="form-label">辅助邮箱 (可选)</label>
          <input
            type="email"
            class="input"
            v-model="customRecoveryEmail"
            placeholder="recovery@example.com"
          />
          <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 8px;">
            用于账号验证时的备用邮箱
          </p>
        </div>

        <div class="form-group">
          <label class="form-label">2FA密钥/应用密码 (可选)</label>
          <input
            type="text"
            class="input"
            v-model="customTotpSecret"
            placeholder="TOTP密钥或应用专用密码"
          />
          <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 8px;">
            如有两步验证，请填写TOTP密钥；如未启用2FA可留空，部署时会提示配置
          </p>
        </div>
      </div>

      <div v-else>
        <div class="alert alert-success">
          系统将自动为您分配一个可用的谷歌账号
        </div>
      </div>

      <div style="display: flex; gap: 12px; margin-top: 20px;">
        <button class="btn" style="background: var(--bg-input);" @click="step = 1">
          上一步
        </button>
        <button
          class="btn btn-primary"
          style="flex: 1;"
          @click="createOrder"
          :disabled="loading || !contactEmail || (selectedPlan === 'custom' && (!customEmail || !customPassword))"
        >
          {{ loading ? '创建中...' : '创建订单' }}
        </button>
      </div>
    </div>

    <!-- 步骤 3: 扫码支付 -->
    <div v-if="step === 3" class="card">
      <h2 class="card-title">扫码支付</h2>

      <div class="order-info">
        <div class="order-info-row">
          <span>订单号</span>
          <span>{{ orderId }}</span>
        </div>
        <div class="order-info-row">
          <span>金额</span>
          <span style="color: var(--primary); font-weight: 600;">¥{{ orderAmount }}</span>
        </div>
        <div class="order-info-row">
          <span>状态</span>
          <span class="status-badge status-pending">待支付</span>
        </div>
        <div class="order-info-row">
          <span>剩余时间</span>
          <span style="color: var(--danger); font-weight: 600;">{{ formatCountdown }}</span>
        </div>
      </div>

      <div v-if="countdown <= 0" class="alert alert-danger" style="margin-bottom: 16px;">
        订单已过期，请返回重新创建订单
      </div>

      <div class="qrcode-container">
        <img v-if="qrcodeUrl" :src="qrcodeUrl" alt="支付宝收款码" />
        <div v-else style="padding: 40px; background: var(--bg-input); border-radius: 8px;">
          <p style="color: var(--text-muted);">请联系管理员获取收款码</p>
        </div>
        <p style="color: var(--text-muted);">请使用支付宝扫描二维码完成支付</p>
        <p style="color: var(--warning); font-size: 0.9rem; margin-top: 8px;">
          支付时请备注订单号: {{ orderId }}
        </p>
      </div>

      <button
        class="btn btn-success btn-block"
        @click="checkPayment"
        :disabled="checkingPayment || countdown <= 0"
      >
        {{ checkingPayment ? '查询中...' : (countdown <= 0 ? '订单已过期' : '我已支付，查询订单状态') }}
      </button>

      <button
        v-if="countdown > 0"
        class="btn btn-block"
        style="margin-top: 12px; background: var(--bg-input);"
        @click="cancelOrder"
        :disabled="cancellingOrder"
      >
        {{ cancellingOrder ? '取消中...' : '取消订单' }}
      </button>

      <button
        v-if="countdown <= 0"
        class="btn btn-primary btn-block"
        style="margin-top: 12px;"
        @click="resetOrder"
      >
        重新创建订单
      </button>

      <p style="text-align: center; color: var(--text-muted); margin-top: 12px; font-size: 0.9rem;">
        {{ countdown > 0 ? '管理员确认收款后，密钥将自动生成' : '' }}
      </p>
    </div>

    <!-- 步骤 4: 获取密钥 -->
    <div v-if="step === 4" class="card">
      <h2 class="card-title" style="color: var(--success);">
        ✓ 支付成功
      </h2>

      <p style="margin-bottom: 20px;">您的部署密钥已生成，请妥善保管：</p>

      <div class="key-display">
        {{ keyCode }}
      </div>

      <button class="btn btn-primary btn-block" @click="copyKey">
        复制密钥
      </button>

      <div class="alert alert-warning" style="margin-top: 20px;">
        <strong>重要提示：</strong>
        <ul style="margin-top: 8px; padding-left: 20px;">
          <li>此密钥为一次性使用，部署成功后将失效</li>
          <li>请下载部署脚本，输入密钥后选择系统进行部署</li>
          <li>如有问题，请联系客服</li>
        </ul>
      </div>

      <button
        class="btn btn-success btn-block"
        style="margin-top: 16px;"
        @click="copyDownloadCommand"
      >
        下载部署脚本
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import axios from 'axios'

const step = ref(1)
const selectedPlan = ref(null)
const prices = ref({ builtin: 60, custom: 50, builtinStock: 0 })
const contactEmail = ref('')
const customEmail = ref('')
const customPassword = ref('')
const customRecoveryEmail = ref('')
const customTotpSecret = ref('')
const loading = ref(false)
const countdown = ref(600) // 10分钟 = 600秒
let countdownTimer = null
const orderId = ref('')
const orderAmount = ref(0)
const qrcodeUrl = ref('')
const orderCreatedAt = ref(0) // 订单创建时间戳
const checkingPayment = ref(false)
const cancellingOrder = ref(false)
const keyCode = ref('')

// 格式化倒计时显示
const formatCountdown = computed(() => {
  const mins = Math.floor(countdown.value / 60)
  const secs = countdown.value % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
})

// 启动倒计时
function startCountdown(createdAt = null) {
  // 清除之前的计时器
  if (countdownTimer) {
    clearInterval(countdownTimer)
  }

  // 如果有创建时间，计算剩余秒数
  if (createdAt) {
    const expireTime = createdAt + 10 * 60 * 1000
    const remaining = Math.floor((expireTime - Date.now()) / 1000)
    countdown.value = Math.max(0, remaining)
  } else {
    countdown.value = 600 // 重置为10分钟
  }

  if (countdown.value > 0) {
    countdownTimer = setInterval(() => {
      if (countdown.value > 0) {
        countdown.value--
      } else {
        clearInterval(countdownTimer)
        countdownTimer = null
      }
    }, 1000)
  }
}

// 重置订单（返回第一步）
function resetOrder() {
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
  orderId.value = ''
  orderAmount.value = 0
  qrcodeUrl.value = ''
  orderCreatedAt.value = 0
  countdown.value = 600
  step.value = 1
  // 清除 localStorage
  localStorage.removeItem('pendingOrder')
}

// 获取价格并恢复订单状态
onMounted(async () => {
  try {
    const { data } = await axios.get('/api/prices')
    prices.value = data
  } catch (e) {
    console.error('获取价格失败', e)
  }

  // 恢复未完成的订单
  const savedOrder = localStorage.getItem('pendingOrder')
  if (savedOrder) {
    try {
      const order = JSON.parse(savedOrder)
      const expireTime = order.createdAt + 10 * 60 * 1000

      // 检查订单是否已过期
      if (Date.now() < expireTime) {
        orderId.value = order.orderId
        orderAmount.value = order.amount
        qrcodeUrl.value = order.qrcodeUrl
        orderCreatedAt.value = order.createdAt
        selectedPlan.value = order.plan
        step.value = 3
        startCountdown(order.createdAt)
      } else {
        // 订单已过期，清除 localStorage
        localStorage.removeItem('pendingOrder')
      }
    } catch (e) {
      console.error('恢复订单失败', e)
      localStorage.removeItem('pendingOrder')
    }
  }
})

// 组件卸载时清理计时器
onUnmounted(() => {
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
})

function selectPlan(plan) {
  selectedPlan.value = plan
}

function nextStep() {
  if (selectedPlan.value === 'builtin') {
    step.value = 2
  } else {
    step.value = 2
  }
}

async function createOrder() {
  loading.value = true

  try {
    const endpoint = selectedPlan.value === 'builtin' ? '/api/order/builtin' : '/api/order/custom'
    const basePayload = { contactEmail: contactEmail.value }
    const payload = selectedPlan.value === 'custom' ? {
      ...basePayload,
      email: customEmail.value,
      password: customPassword.value,
      recoveryEmail: customRecoveryEmail.value,
      totpSecret: customTotpSecret.value
    } : basePayload

    const { data } = await axios.post(endpoint, payload)

    // 使用后端返回的创建时间（转换为时间戳），保证前后端时间同步
    // SQLite CURRENT_TIMESTAMP 返回的是 UTC 时间，需要加 'Z' 后缀告诉 JS 这是 UTC
    const createdAt = data.createdAt ? new Date(data.createdAt + 'Z').getTime() : Date.now()
    orderId.value = data.orderId
    orderAmount.value = data.amount
    qrcodeUrl.value = data.qrcodeUrl
    orderCreatedAt.value = createdAt
    step.value = 3

    // 保存订单到 localStorage
    localStorage.setItem('pendingOrder', JSON.stringify({
      orderId: data.orderId,
      amount: data.amount,
      qrcodeUrl: data.qrcodeUrl,
      createdAt: createdAt,
      plan: selectedPlan.value
    }))

    startCountdown(createdAt) // 启动倒计时，传入创建时间
  } catch (error) {
    alert(error.response?.data?.error || '创建订单失败')
  } finally {
    loading.value = false
  }
}

async function checkPayment() {
  checkingPayment.value = true

  try {
    const { data } = await axios.get(`/api/order/${orderId.value}`)

    if (data.status === 'paid') {
      keyCode.value = data.keyCode
      step.value = 4
      // 支付成功，清除待支付订单
      localStorage.removeItem('pendingOrder')
      if (countdownTimer) {
        clearInterval(countdownTimer)
        countdownTimer = null
      }
    } else {
      alert('订单尚未确认，请稍后再试或联系管理员')
    }
  } catch (error) {
    alert('查询失败，请稍后再试')
  } finally {
    checkingPayment.value = false
  }
}

async function cancelOrder() {
  if (!confirm('确定要取消订单吗？取消后账号将被释放。')) {
    return
  }

  cancellingOrder.value = true

  try {
    await axios.post(`/api/order/${orderId.value}/cancel`)
    // 取消成功，重置状态
    resetOrder()
  } catch (error) {
    alert(error.response?.data?.error || '取消订单失败')
  } finally {
    cancellingOrder.value = false
  }
}

function copyKey() {
  copyToClipboard(keyCode.value, '密钥已复制到剪贴板')
}

function copyDownloadCommand() {
  const baseUrl = window.location.origin
  const downloadUrl = `${baseUrl}/api/download/${keyCode.value}`
  // 使用 cmd /k 保持窗口打开
  const command = `powershell -Command "Invoke-WebRequest -Uri '${downloadUrl}' -OutFile 'cliproxyapi.zip'; Expand-Archive -Path 'cliproxyapi.zip' -DestinationPath '.' -Force; Remove-Item 'cliproxyapi.zip'; Start-Process cmd -ArgumentList '/k','cd /d cliproxyapi && start.bat'"`
  copyToClipboard(command, '部署命令已复制！\n\n请粘贴到 PowerShell 执行')
}

function copyToClipboard(text, successMessage) {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(() => {
      alert(successMessage)
    }).catch(() => {
      fallbackCopy(text, successMessage)
    })
  } else {
    fallbackCopy(text, successMessage)
  }
}

function fallbackCopy(text, successMessage) {
  const textArea = document.createElement('textarea')
  textArea.value = text
  textArea.style.position = 'fixed'
  textArea.style.left = '-9999px'
  textArea.style.top = '-9999px'
  document.body.appendChild(textArea)
  textArea.focus()
  textArea.select()
  try {
    document.execCommand('copy')
    alert(successMessage)
  } catch (err) {
    alert('复制失败，请手动复制')
  }
  document.body.removeChild(textArea)
}
</script>
