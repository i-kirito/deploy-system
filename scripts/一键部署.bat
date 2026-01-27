@echo off
chcp 65001 >nul 2>&1
title CLIProxyAPI 一键部署

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║                                                              ║
echo ║         CLIProxyAPI 一键部署工具 v1.0                        ║
echo ║                                                              ║
echo ║         支持 Claude Code / Gemini CLI / Codex                ║
echo ║                                                              ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

:: 检查 PowerShell 是否可用
where powershell >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未找到 PowerShell，无法继续
    pause
    exit /b 1
)

:: 运行 PowerShell 脚本
powershell -ExecutionPolicy Bypass -File "%~dp0deploy-windows.ps1"

:: 如果 PowerShell 脚本删除了自身，也删除这个 bat 文件
if not exist "%~dp0deploy-windows.ps1" (
    (goto) 2>nul & del "%~f0"
)

pause
