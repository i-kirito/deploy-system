import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import './style.css'

// 路由配置
const routes = [
  { path: '/', component: () => import('./views/Home.vue') },
  { path: '/query', component: () => import('./views/Query.vue') },
  { path: '/order/:orderId', component: () => import('./views/Order.vue') },
  { path: '/admin', component: () => import('./views/Admin.vue') },
  { path: '/admin/login', component: () => import('./views/AdminLogin.vue') }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 路由守卫
router.beforeEach((to, from, next) => {
  if (to.path.startsWith('/admin') && to.path !== '/admin/login') {
    const token = localStorage.getItem('adminToken')
    if (!token) {
      next('/admin/login')
      return
    }
  }
  next()
})

const app = createApp(App)
app.use(router)
app.mount('#app')
