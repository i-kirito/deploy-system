<template>
  <div class="container" style="max-width: 600px; margin-top: 50px;">
    <div class="card">
      <h2 class="card-title">订单查询</h2>

      <div class="order-info">
        <div class="order-info-row">
          <span>订单号</span>
          <span>{{ order.orderId }}</span>
        </div>
        <div class="order-info-row">
          <span>金额</span>
          <span style="color: var(--primary); font-weight: 600;">¥{{ order.amount }}</span>
        </div>
        <div class="order-info-row">
          <span>状态</span>
          <span>
            <span v-if="order.isUsed" class="status-badge status-used">已使用</span>
            <span v-else-if="order.status === 'paid'" class="status-badge status-paid">已支付</span>
            <span v-else class="status-badge status-pending">待支付</span>
          </span>
        </div>
      </div>

      <div v-if="order.status === 'paid' && order.keyCode && !order.isUsed">
        <p style="margin-bottom: 12px;">您的部署密钥：</p>
        <div class="key-display">{{ order.keyCode }}</div>
        <button class="btn btn-primary btn-block" @click="copyKey">复制密钥</button>
      </div>

      <div v-else-if="order.isUsed" class="alert alert-warning">
        此密钥已被使用，无法再次使用
      </div>

      <div v-else-if="order.status === 'pending'">
        <div class="alert alert-warning">
          订单尚未支付，请完成支付后等待管理员确认
        </div>
        <button class="btn btn-primary btn-block" @click="refresh">刷新状态</button>
      </div>

      <router-link to="/" class="btn btn-block" style="margin-top: 16px; background: var(--bg-input); text-decoration: none; color: var(--text);">
        返回首页
      </router-link>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import axios from 'axios'

const route = useRoute()
const order = ref({
  orderId: '',
  amount: 0,
  status: 'pending',
  keyCode: null,
  isUsed: false
})

onMounted(async () => {
  await loadOrder()
})

async function loadOrder() {
  try {
    const { data } = await axios.get(`/api/order/${route.params.orderId}`)
    order.value = data
  } catch (e) {
    alert('订单不存在')
  }
}

function copyKey() {
  navigator.clipboard.writeText(order.value.keyCode)
  alert('密钥已复制到剪贴板')
}

function refresh() {
  loadOrder()
}
</script>
