<#
.SYNOPSIS
    CLIProxyAPI 一键部署脚本 (Windows)
.DESCRIPTION
    自动验证密钥并部署 CLIProxyAPI 服务
    部署成功后脚本自动销毁
#>

# ===================== 配置区域 =====================
$API_SERVER = "http://your-server.com"  # 替换为实际的密钥验证服务器地址
$DOWNLOAD_URL = "https://github.com/router-for-me/CLIProxyAPI/releases/latest/download/cli-proxy-api-windows-amd64.exe"
$INSTALL_DIR = "$env:USERPROFILE\.cli-proxy-api"
$CONFIG_FILE = "$INSTALL_DIR\config.yaml"
$EXE_FILE = "$INSTALL_DIR\cli-proxy-api.exe"
# =====================================================

# 设置控制台编码
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$Host.UI.RawUI.WindowTitle = "CLIProxyAPI 一键部署"

function Write-ColorText {
    param([string]$Text, [string]$Color = "White")
    Write-Host $Text -ForegroundColor $Color
}

function Show-Banner {
    Clear-Host
    Write-ColorText @"
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║         CLIProxyAPI 一键部署工具 v1.0                        ║
║                                                              ║
║         支持 Claude Code / Gemini CLI / Codex                ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
"@ "Cyan"
    Write-Host ""
}

function Get-DeployKey {
    Write-ColorText "请输入部署密钥 (格式: XXXX-XXXX-XXXX):" "Yellow"
    $key = Read-Host "密钥"
    return $key.ToUpper().Trim()
}

function Verify-Key {
    param([string]$Key)

    Write-ColorText "`n正在验证密钥..." "Cyan"

    try {
        $body = @{ keyCode = $Key } | ConvertTo-Json
        $response = Invoke-RestMethod -Uri "$API_SERVER/api/key/verify" -Method POST -Body $body -ContentType "application/json"

        if ($response.valid) {
            Write-ColorText "密钥验证成功!" "Green"
            return $response
        } else {
            Write-ColorText "密钥无效" "Red"
            return $null
        }
    } catch {
        $errorMsg = $_.ErrorDetails.Message | ConvertFrom-Json -ErrorAction SilentlyContinue
        if ($errorMsg.error) {
            Write-ColorText "验证失败: $($errorMsg.error)" "Red"
        } else {
            Write-ColorText "验证失败: 无法连接到服务器" "Red"
        }
        return $null
    }
}

function Select-System {
    Write-ColorText "`n请选择部署系统:" "Yellow"
    Write-Host "  [1] Windows (当前系统)"
    Write-Host "  [2] Linux (生成远程部署命令)"
    Write-Host "  [3] macOS (生成远程部署命令)"
    Write-Host ""

    $choice = Read-Host "请输入选项 (1-3)"
    return $choice
}

function Install-Windows {
    param($KeyData)

    Write-ColorText "`n开始部署 Windows 版本..." "Cyan"

    # 创建安装目录
    if (-not (Test-Path $INSTALL_DIR)) {
        New-Item -ItemType Directory -Path $INSTALL_DIR -Force | Out-Null
        Write-ColorText "创建目录: $INSTALL_DIR" "Gray"
    }

    # 下载主程序
    Write-ColorText "正在下载 CLIProxyAPI..." "Cyan"
    try {
        # 使用 GitHub API 获取最新版本
        $releases = Invoke-RestMethod -Uri "https://api.github.com/repos/router-for-me/CLIProxyAPI/releases/latest"
        $asset = $releases.assets | Where-Object { $_.name -like "*windows*amd64*.exe" } | Select-Object -First 1

        if ($asset) {
            $downloadUrl = $asset.browser_download_url
        } else {
            $downloadUrl = $DOWNLOAD_URL
        }

        Invoke-WebRequest -Uri $downloadUrl -OutFile $EXE_FILE -UseBasicParsing
        Write-ColorText "下载完成!" "Green"
    } catch {
        Write-ColorText "下载失败，尝试备用地址..." "Yellow"
        try {
            Invoke-WebRequest -Uri $DOWNLOAD_URL -OutFile $EXE_FILE -UseBasicParsing
            Write-ColorText "下载完成!" "Green"
        } catch {
            Write-ColorText "下载失败: $_" "Red"
            return $false
        }
    }

    # 创建配置文件
    Write-ColorText "正在配置..." "Cyan"

    $configContent = @"
# CLIProxyAPI 配置文件 - 自动生成
host: ""
port: 8317

remote-management:
  allow-remote: false
  secret-key: "admin123"
  disable-control-panel: false

auth-dir: "~/.cli-proxy-api"

api-keys:
  - "your-api-key"

debug: false
request-retry: 3

# 预配置的 Google OAuth 账号
# 账号邮箱: $($KeyData.email)
"@

    $configContent | Out-File -FilePath $CONFIG_FILE -Encoding UTF8
    Write-ColorText "配置文件已创建: $CONFIG_FILE" "Green"

    # 创建 OAuth 凭据目录和文件
    $authDir = "$env:USERPROFILE\.cli-proxy-api"
    if (-not (Test-Path $authDir)) {
        New-Item -ItemType Directory -Path $authDir -Force | Out-Null
    }

    # 保存 refresh token
    $credentialFile = "$authDir\antigravity_credentials.json"
    $credContent = @{
        email = $KeyData.email
        refresh_token = $KeyData.refreshToken
        token_type = "Bearer"
    } | ConvertTo-Json

    $credContent | Out-File -FilePath $credentialFile -Encoding UTF8
    Write-ColorText "OAuth 凭据已配置" "Green"

    # 创建启动脚本
    $startScript = @"
@echo off
cd /d "$INSTALL_DIR"
start "" "$EXE_FILE"
timeout /t 3 /nobreak >nul
start http://127.0.0.1:8317/management.html
"@
    $startScript | Out-File -FilePath "$INSTALL_DIR\启动服务.bat" -Encoding ASCII

    Write-ColorText "`n部署完成!" "Green"
    Write-ColorText "安装目录: $INSTALL_DIR" "Cyan"
    Write-ColorText "`n运行方式:" "Yellow"
    Write-Host "  1. 双击运行: $INSTALL_DIR\启动服务.bat"
    Write-Host "  2. 或直接运行: $EXE_FILE"
    Write-Host ""
    Write-ColorText "管理面板: http://127.0.0.1:8317/management.html" "Cyan"

    return $true
}

function Generate-LinuxCommand {
    param($KeyData)

    Write-ColorText "`n请在 Linux 服务器上执行以下命令:" "Yellow"
    Write-Host ""

    $command = @"
# CLIProxyAPI Linux 一键部署命令
curl -fsSL https://github.com/router-for-me/CLIProxyAPI/releases/latest/download/cli-proxy-api-linux-amd64 -o /usr/local/bin/cli-proxy-api && \
chmod +x /usr/local/bin/cli-proxy-api && \
mkdir -p ~/.cli-proxy-api && \
echo '{"email":"$($KeyData.email)","refresh_token":"$($KeyData.refreshToken)","token_type":"Bearer"}' > ~/.cli-proxy-api/antigravity_credentials.json && \
echo "部署完成! 运行: cli-proxy-api"
"@

    Write-Host $command -ForegroundColor Gray
    Write-Host ""

    # 复制到剪贴板
    $command | Set-Clipboard
    Write-ColorText "命令已复制到剪贴板!" "Green"

    return $true
}

function Generate-MacCommand {
    param($KeyData)

    Write-ColorText "`n请在 macOS 终端执行以下命令:" "Yellow"
    Write-Host ""

    $command = @"
# CLIProxyAPI macOS 一键部署命令
curl -fsSL https://github.com/router-for-me/CLIProxyAPI/releases/latest/download/cli-proxy-api-darwin-arm64 -o /usr/local/bin/cli-proxy-api && \
chmod +x /usr/local/bin/cli-proxy-api && \
mkdir -p ~/.cli-proxy-api && \
echo '{"email":"$($KeyData.email)","refresh_token":"$($KeyData.refreshToken)","token_type":"Bearer"}' > ~/.cli-proxy-api/antigravity_credentials.json && \
echo "部署完成! 运行: cli-proxy-api"
"@

    Write-Host $command -ForegroundColor Gray
    Write-Host ""

    # 复制到剪贴板
    $command | Set-Clipboard
    Write-ColorText "命令已复制到剪贴板!" "Green"

    return $true
}

function Consume-Key {
    param([string]$Key)

    try {
        $body = @{ keyCode = $Key } | ConvertTo-Json
        $null = Invoke-RestMethod -Uri "$API_SERVER/api/key/consume" -Method POST -Body $body -ContentType "application/json"
        return $true
    } catch {
        return $false
    }
}

function Self-Destruct {
    Write-ColorText "`n密钥已使用，脚本即将自毁..." "Yellow"
    Start-Sleep -Seconds 3

    # 删除自身
    $scriptPath = $MyInvocation.MyCommand.Path
    if ($scriptPath) {
        Remove-Item -Path $scriptPath -Force -ErrorAction SilentlyContinue
    }
}

# ===================== 主程序 =====================

Show-Banner

# 获取并验证密钥
$deployKey = Get-DeployKey

if (-not $deployKey) {
    Write-ColorText "未输入密钥，程序退出" "Red"
    Read-Host "按 Enter 退出"
    exit 1
}

$keyData = Verify-Key -Key $deployKey

if (-not $keyData) {
    Read-Host "按 Enter 退出"
    exit 1
}

Write-ColorText "`n账号信息:" "Cyan"
Write-Host "  邮箱: $($keyData.email)"
Write-Host "  类型: $(if($keyData.keyType -eq 'builtin'){'内置账号'}else{'自有账号'})"

# 选择系统
$systemChoice = Select-System

$success = $false
switch ($systemChoice) {
    "1" { $success = Install-Windows -KeyData $keyData }
    "2" { $success = Generate-LinuxCommand -KeyData $keyData }
    "3" { $success = Generate-MacCommand -KeyData $keyData }
    default {
        Write-ColorText "无效选项" "Red"
        Read-Host "按 Enter 退出"
        exit 1
    }
}

if ($success) {
    # 标记密钥已使用
    $consumed = Consume-Key -Key $deployKey

    if ($consumed) {
        Write-ColorText "`n密钥已成功使用并失效" "Green"
    }

    Write-ColorText "`n感谢使用 CLIProxyAPI 一键部署工具!" "Cyan"

    # 询问是否立即启动 (仅 Windows)
    if ($systemChoice -eq "1") {
        $startNow = Read-Host "`n是否立即启动服务? (Y/N)"
        if ($startNow -eq "Y" -or $startNow -eq "y") {
            Start-Process -FilePath "$INSTALL_DIR\启动服务.bat"
        }
    }

    # 自毁
    Self-Destruct
} else {
    Write-ColorText "`n部署失败" "Red"
}

Read-Host "`n按 Enter 退出"
