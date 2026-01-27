# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

CLIProxyAPI 一键部署系统 - 付费自动部署解决方案，包含前后端分离架构。

## 常用命令

```bash
# 后端开发
cd server && npm install && node index.js

# 前端开发
cd web && npm install && npm run dev

# 前端构建
cd web && npm run build

# 服务运行端口: 3030
```

## 部署到远程服务器

```bash
# 提交代码
git add -A && git commit -m "描述" && git push

# 同步到服务器 (8.134.251.200)
sshpass -p 'Lwh815315..' ssh root@8.134.251.200 "cd /deploy-system && git pull && lsof -ti:3030 | xargs kill -9 2>/dev/null; cd server && nohup node index.js > /var/log/deploy-system.log 2>&1 &"
```

## 架构

- **server/index.js**: Express 后端，使用 sql.js (SQLite)，端口 3030
- **web/**: Vue 3 + Vite 前端，构建输出到 `dist/`
- **数据库**: `server/deploy.db` (SQLite)，包含 orders、deploy_keys、google_accounts、admins 表

## 核心业务逻辑

1. **订单流程**: 用户选择方案 → 创建订单 → 扫码支付 → 管理员确认 → 生成密钥
2. **密钥类型**:
   - `builtin`: 使用系统账号池分配
   - `custom`: 用户自有账号
3. **部署包下载**: `/api/key/download/:keyCode` 返回包含账号信息和启动脚本的 ZIP

## 前端页面

- `Home.vue`: 用户购买页面
- `Order.vue`: 订单查询
- `Admin.vue`: 管理后台 (订单/账号/配置管理)
- `AdminLogin.vue`: 管理员登录

## 批量添加账号格式

支持两种分隔符：
- `email|password|recovery|2fa`
- `email---password---recovery---2fa`
