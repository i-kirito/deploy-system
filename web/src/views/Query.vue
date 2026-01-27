<template>
  <div class="container" style="max-width: 600px; margin-top: 50px;">
    <div class="card">
      <h2 class="card-title">订单查询</h2>
      <p style="color: var(--text-muted); margin-bottom: 20px;">
        通过密钥或联系邮箱查询订单详情
      </p>

      <!-- 查询方式切换 -->
      <div v-if="!orderInfo && orderList.length === 0" class="query-tabs" style="display: flex; margin-bottom: 20px;">
        <button
          class="tab-btn"
          :class="{ active: queryType === 'key' }"
          @click="queryType = 'key'; error = ''"
        >
          密钥查询
        </button>
        <button
          class="tab-btn"
          :class="{ active: queryType === 'email' }"
          @click="queryType = 'email'; error = ''"
        >
          邮箱查询
        </button>
      </div>

      <!-- 密钥查询表单 -->
      <div v-if="!orderInfo && orderList.length === 0 && queryType === 'key'" class="form-group">
        <label class="form-label">部署密钥</label>
        <input
          type="text"
          class="input"
          v-model="keyCode"
          placeholder="请输入16位密钥，如 XXXX-XXXX-XXXX-XXXX"
          @keyup.enter="queryByKey"
        />
      </div>

      <!-- 邮箱查询表单 -->
      <div v-if="!orderInfo && orderList.length === 0 && queryType === 'email'" class="form-group">
        <label class="form-label">联系邮箱</label>
        <input
          type="email"
          class="input"
          v-model="email"
          placeholder="请输入下单时填写的联系邮箱"
          @keyup.enter="queryByEmail"
        />
      </div>

      <div v-if="error" class="alert alert-danger" style="margin-bottom: 16px;">
        {{ error }}
      </div>

      <button
        v-if="!orderInfo && orderList.length === 0"
        class="btn btn-primary btn-block"
        @click="queryType === 'key' ? queryByKey() : queryByEmail()"
        :disabled="loading || (queryType === 'key' ? !keyCode : !email)"
      >
        {{ loading ? '查询中...' : '查询订单' }}
      </button>

      <!-- 订单列表（邮箱查询可能返回多个订单） -->
      <div v-if="orderList.length > 0 && !orderInfo">
        <p style="margin-bottom: 16px; color: var(--text-muted);">
          找到 {{ orderList.length }} 个订单，请选择要查看的订单：
        </p>
        <div
          v-for="order in orderList"
          :key="order.orderId"
          class="order-item"
          @click="selectOrder(order)"
        >
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-weight: 600;">{{ order.orderId }}</div>
              <div style="font-size: 0.85rem; color: var(--text-muted);">
                {{ formatDate(order.createdAt) }} · ¥{{ order.amount }}
              </div>
            </div>
            <div>
              <span v-if="order.isUsed" class="status-badge status-used">已使用</span>
              <span v-else-if="order.status === 'paid'" class="status-badge status-paid">已支付</span>
              <span v-else class="status-badge status-pending">待支付</span>
            </div>
          </div>
        </div>
        <button
          class="btn btn-block"
          style="margin-top: 16px; background: var(--bg-input);"
          @click="resetQuery"
        >
          重新查询
        </button>
      </div>

      <!-- 单个订单信息展示 -->
      <div v-if="orderInfo">
        <div class="order-info">
          <div class="order-info-row">
            <span>订单号</span>
            <span>{{ orderInfo.orderId }}</span>
          </div>
          <div class="order-info-row">
            <span>订单类型</span>
            <span>{{ orderInfo.keyType === 'builtin' ? '内置账号' : '自有账号' }}</span>
          </div>
          <div class="order-info-row">
            <span>金额</span>
            <span style="color: var(--primary); font-weight: 600;">¥{{ orderInfo.amount }}</span>
          </div>
          <div class="order-info-row">
            <span>状态</span>
            <span>
              <span v-if="orderInfo.isUsed" class="status-badge status-used">已使用</span>
              <span v-else-if="orderInfo.status === 'paid'" class="status-badge status-paid">已支付</span>
              <span v-else class="status-badge status-pending">待支付</span>
            </span>
          </div>
          <div class="order-info-row">
            <span>创建时间</span>
            <span>{{ formatDate(orderInfo.createdAt) }}</span>
          </div>
        </div>

        <!-- 密钥显示 -->
        <div v-if="orderInfo.status === 'paid' && orderInfo.keyCode && !orderInfo.isUsed" style="margin-top: 20px;">
          <p style="margin-bottom: 12px;">您的部署密钥：</p>
          <div class="key-display">{{ orderInfo.keyCode }}</div>
          <button class="btn btn-primary btn-block" @click="copyKey">复制密钥</button>
          <button class="btn btn-success btn-block" style="margin-top: 12px;" @click="copyDownloadCommand">下载部署脚本</button>
        </div>

        <div v-if="orderInfo.isUsed" class="alert alert-warning" style="margin-top: 20px;">
          此密钥已被使用，无法再次使用
        </div>

        <div v-if="orderInfo.status === 'pending'" class="alert alert-warning" style="margin-top: 20px;">
          订单尚未支付，请完成支付后等待管理员确认
        </div>

        <button
          class="btn btn-block"
          style="margin-top: 16px; background: var(--bg-input);"
          @click="resetQuery"
        >
          重新查询
        </button>
      </div>

      <router-link
        to="/"
        class="btn btn-block"
        style="margin-top: 16px; background: var(--bg-input); text-decoration: none; color: var(--text);"
      >
        返回首页
      </router-link>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import axios from 'axios'

const queryType = ref('key')
const keyCode = ref('')
const email = ref('')
const loading = ref(false)
const error = ref('')
const orderInfo = ref(null)
const orderList = ref([])

async function queryByKey() {
  if (!keyCode.value) {
    error.value = '请输入密钥'
    return
  }

  loading.value = true
  error.value = ''

  try {
    const { data } = await axios.post('/api/key/query', {
      keyCode: keyCode.value
    })
    orderInfo.value = data
  } catch (e) {
    error.value = e.response?.data?.error || '查询失败，请检查密钥是否正确'
  } finally {
    loading.value = false
  }
}

async function queryByEmail() {
  if (!email.value) {
    error.value = '请输入邮箱'
    return
  }

  loading.value = true
  error.value = ''

  try {
    const { data } = await axios.post('/api/order/query-by-email', {
      email: email.value
    })
    if (data.length === 0) {
      error.value = '未找到相关订单'
    } else if (data.length === 1) {
      orderInfo.value = data[0]
    } else {
      orderList.value = data
    }
  } catch (e) {
    error.value = e.response?.data?.error || '查询失败，请检查邮箱是否正确'
  } finally {
    loading.value = false
  }
}

function selectOrder(order) {
  orderInfo.value = order
  orderList.value = []
}

function resetQuery() {
  orderInfo.value = null
  orderList.value = []
  keyCode.value = ''
  email.value = ''
  error.value = ''
}

function copyKey() {
  copyToClipboard(orderInfo.value.keyCode, '密钥已复制到剪贴板')
}

function copyDownloadCommand() {
  const baseUrl = window.location.origin
  const downloadUrl = `${baseUrl}/api/download/${orderInfo.value.keyCode}`
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

function formatDate(dateStr) {
  if (!dateStr) return '-'
  const date = new Date(dateStr + 'Z')
  return date.toLocaleString('zh-CN')
}
</script>

<style scoped>
.query-tabs {
  border-radius: 8px;
  overflow: hidden;
  background: var(--bg-input);
}

.tab-btn {
  flex: 1;
  padding: 12px 20px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 0.95rem;
}

.tab-btn.active {
  background: var(--primary);
  color: white;
}

.tab-btn:hover:not(.active) {
  background: rgba(99, 102, 241, 0.2);
}

.order-item {
  padding: 16px;
  background: var(--bg-input);
  border-radius: 8px;
  margin-bottom: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
  border: 2px solid transparent;
}

.order-item:hover {
  border-color: var(--primary);
  transform: translateY(-2px);
}
</style>
