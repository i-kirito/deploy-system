<template>
  <div class="container" style="max-width: 400px; margin-top: 100px;">
    <div class="card">
      <h2 class="card-title">管理员登录</h2>

      <div class="form-group">
        <label class="form-label">用户名</label>
        <input type="text" class="input" v-model="username" placeholder="请输入用户名" />
      </div>

      <div class="form-group">
        <label class="form-label">密码</label>
        <input
          type="password"
          class="input"
          v-model="password"
          placeholder="请输入密码"
          @keyup.enter="login"
        />
      </div>

      <div v-if="error" class="alert alert-danger">
        {{ error }}
      </div>

      <button class="btn btn-primary btn-block" @click="login" :disabled="loading">
        {{ loading ? '登录中...' : '登录' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'

const router = useRouter()
const username = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

async function login() {
  if (!username.value || !password.value) {
    error.value = '请输入用户名和密码'
    return
  }

  loading.value = true
  error.value = ''

  try {
    const { data } = await axios.post('/api/admin/login', {
      username: username.value,
      password: password.value
    })

    localStorage.setItem('adminToken', data.token)
    router.push('/admin')
  } catch (e) {
    error.value = e.response?.data?.error || '登录失败'
  } finally {
    loading.value = false
  }
}
</script>
