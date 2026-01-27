<template>
  <!-- 动态背景 -->
  <div class="animated-bg">
    <div class="floating-orb"></div>
    <div class="floating-orb"></div>
    <div class="floating-orb"></div>
  </div>

  <!-- 主题切换按钮 -->
  <button class="theme-toggle" @click="toggleTheme" :title="isDark ? '切换到浅色模式' : '切换到深色模式'">
    <span class="icon">{{ isDark ? '☀️' : '🌙' }}</span>
  </button>

  <router-view />
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'

const isDark = ref(true)

// 初始化主题
onMounted(() => {
  const savedTheme = localStorage.getItem('theme')
  if (savedTheme) {
    isDark.value = savedTheme === 'dark'
  } else {
    // 检测系统偏好
    isDark.value = window.matchMedia('(prefers-color-scheme: dark)').matches
  }
  applyTheme()
})

// 监听主题变化
watch(isDark, () => {
  applyTheme()
})

function applyTheme() {
  if (isDark.value) {
    document.documentElement.removeAttribute('data-theme')
  } else {
    document.documentElement.setAttribute('data-theme', 'light')
  }
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
}

function toggleTheme() {
  isDark.value = !isDark.value
}
</script>
