#!/bin/bash
#
# CLIProxyAPI 一键部署脚本 (Linux/macOS)
# 自动验证密钥并部署 CLIProxyAPI 服务
# 部署成功后脚本自动销毁
#

# ===================== 配置区域 =====================
API_SERVER="http://your-server.com"  # 替换为实际的密钥验证服务器地址
INSTALL_DIR="$HOME/.cli-proxy-api"
CONFIG_FILE="$INSTALL_DIR/config.yaml"
# =====================================================

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 检测系统类型
detect_os() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        OS="linux"
        ARCH=$(uname -m)
        if [[ "$ARCH" == "x86_64" ]]; then
            BINARY_NAME="cli-proxy-api-linux-amd64"
        elif [[ "$ARCH" == "aarch64" ]]; then
            BINARY_NAME="cli-proxy-api-linux-arm64"
        else
            echo -e "${RED}不支持的架构: $ARCH${NC}"
            exit 1
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        OS="darwin"
        ARCH=$(uname -m)
        if [[ "$ARCH" == "arm64" ]]; then
            BINARY_NAME="cli-proxy-api-darwin-arm64"
        elif [[ "$ARCH" == "x86_64" ]]; then
            BINARY_NAME="cli-proxy-api-darwin-amd64"
        else
            echo -e "${RED}不支持的架构: $ARCH${NC}"
            exit 1
        fi
    else
        echo -e "${RED}不支持的操作系统: $OSTYPE${NC}"
        exit 1
    fi
}

# 显示 Banner
show_banner() {
    clear
    echo -e "${CYAN}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                                                              ║"
    echo "║         CLIProxyAPI 一键部署工具 v1.0                        ║"
    echo "║                                                              ║"
    echo "║         支持 Claude Code / Gemini CLI / Codex                ║"
    echo "║                                                              ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo ""
}

# 获取密钥
get_deploy_key() {
    echo -e "${YELLOW}请输入部署密钥 (格式: XXXX-XXXX-XXXX):${NC}"
    read -p "密钥: " DEPLOY_KEY
    DEPLOY_KEY=$(echo "$DEPLOY_KEY" | tr '[:lower:]' '[:upper:]' | tr -d ' ')
}

# 验证密钥
verify_key() {
    echo -e "\n${CYAN}正在验证密钥...${NC}"

    RESPONSE=$(curl -s -X POST "$API_SERVER/api/key/verify" \
        -H "Content-Type: application/json" \
        -d "{\"keyCode\": \"$DEPLOY_KEY\"}" 2>/dev/null)

    if [ $? -ne 0 ]; then
        echo -e "${RED}验证失败: 无法连接到服务器${NC}"
        return 1
    fi

    # 检查是否验证成功
    VALID=$(echo "$RESPONSE" | grep -o '"valid":\s*true' | head -1)

    if [ -z "$VALID" ]; then
        ERROR=$(echo "$RESPONSE" | grep -o '"error":"[^"]*"' | sed 's/"error":"//;s/"$//')
        if [ -n "$ERROR" ]; then
            echo -e "${RED}验证失败: $ERROR${NC}"
        else
            echo -e "${RED}密钥无效${NC}"
        fi
        return 1
    fi

    # 提取账号信息
    EMAIL=$(echo "$RESPONSE" | grep -o '"email":"[^"]*"' | sed 's/"email":"//;s/"$//')
    REFRESH_TOKEN=$(echo "$RESPONSE" | grep -o '"refreshToken":"[^"]*"' | sed 's/"refreshToken":"//;s/"$//')
    KEY_TYPE=$(echo "$RESPONSE" | grep -o '"keyType":"[^"]*"' | sed 's/"keyType":"//;s/"$//')

    echo -e "${GREEN}密钥验证成功!${NC}"
    echo -e "\n${CYAN}账号信息:${NC}"
    echo "  邮箱: $EMAIL"
    if [ "$KEY_TYPE" == "builtin" ]; then
        echo "  类型: 内置账号"
    else
        echo "  类型: 自有账号"
    fi

    return 0
}

# 安装 CLIProxyAPI
install_cliproxyapi() {
    echo -e "\n${CYAN}开始部署...${NC}"

    # 创建安装目录
    mkdir -p "$INSTALL_DIR"
    echo -e "创建目录: $INSTALL_DIR"

    # 下载主程序
    echo -e "${CYAN}正在下载 CLIProxyAPI...${NC}"

    # 获取最新版本下载链接
    LATEST_URL="https://github.com/router-for-me/CLIProxyAPI/releases/latest/download/$BINARY_NAME"

    if command -v curl &> /dev/null; then
        curl -fsSL "$LATEST_URL" -o "$INSTALL_DIR/cli-proxy-api"
    elif command -v wget &> /dev/null; then
        wget -q "$LATEST_URL" -O "$INSTALL_DIR/cli-proxy-api"
    else
        echo -e "${RED}错误: 需要 curl 或 wget${NC}"
        return 1
    fi

    if [ ! -f "$INSTALL_DIR/cli-proxy-api" ]; then
        echo -e "${RED}下载失败${NC}"
        return 1
    fi

    chmod +x "$INSTALL_DIR/cli-proxy-api"
    echo -e "${GREEN}下载完成!${NC}"

    # 创建配置文件
    echo -e "${CYAN}正在配置...${NC}"

    cat > "$CONFIG_FILE" << EOF
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
# 账号邮箱: $EMAIL
EOF

    echo -e "${GREEN}配置文件已创建: $CONFIG_FILE${NC}"

    # 保存 OAuth 凭据
    CREDENTIAL_FILE="$INSTALL_DIR/antigravity_credentials.json"
    cat > "$CREDENTIAL_FILE" << EOF
{
    "email": "$EMAIL",
    "refresh_token": "$REFRESH_TOKEN",
    "token_type": "Bearer"
}
EOF

    echo -e "${GREEN}OAuth 凭据已配置${NC}"

    # 创建启动脚本
    cat > "$INSTALL_DIR/start.sh" << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"
./cli-proxy-api
EOF
    chmod +x "$INSTALL_DIR/start.sh"

    # 添加到 PATH (可选)
    if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
        echo -e "\n${YELLOW}建议将以下内容添加到 ~/.bashrc 或 ~/.zshrc:${NC}"
        echo "  export PATH=\"\$PATH:$INSTALL_DIR\""
    fi

    echo -e "\n${GREEN}部署完成!${NC}"
    echo -e "${CYAN}安装目录: $INSTALL_DIR${NC}"
    echo -e "\n${YELLOW}运行方式:${NC}"
    echo "  1. 直接运行: $INSTALL_DIR/cli-proxy-api"
    echo "  2. 或运行: $INSTALL_DIR/start.sh"
    echo ""
    echo -e "${CYAN}管理面板: http://127.0.0.1:8317/management.html${NC}"

    return 0
}

# 标记密钥已使用
consume_key() {
    curl -s -X POST "$API_SERVER/api/key/consume" \
        -H "Content-Type: application/json" \
        -d "{\"keyCode\": \"$DEPLOY_KEY\"}" > /dev/null 2>&1
}

# 自毁
self_destruct() {
    echo -e "\n${YELLOW}密钥已使用，脚本即将自毁...${NC}"
    sleep 3

    # 删除自身
    SCRIPT_PATH="$(realpath "$0")"
    rm -f "$SCRIPT_PATH" 2>/dev/null
}

# ===================== 主程序 =====================

# 检测系统
detect_os

# 显示 Banner
show_banner

echo -e "检测到系统: ${CYAN}$OS ($ARCH)${NC}"
echo ""

# 获取密钥
get_deploy_key

if [ -z "$DEPLOY_KEY" ]; then
    echo -e "${RED}未输入密钥，程序退出${NC}"
    exit 1
fi

# 验证密钥
if ! verify_key; then
    echo -e "\n按 Enter 退出..."
    read
    exit 1
fi

# 安装
if install_cliproxyapi; then
    # 标记密钥已使用
    consume_key
    echo -e "\n${GREEN}密钥已成功使用并失效${NC}"

    echo -e "\n${CYAN}感谢使用 CLIProxyAPI 一键部署工具!${NC}"

    # 询问是否立即启动
    echo ""
    read -p "是否立即启动服务? (y/N): " START_NOW
    if [[ "$START_NOW" == "y" || "$START_NOW" == "Y" ]]; then
        echo -e "\n${CYAN}正在启动服务...${NC}"
        cd "$INSTALL_DIR"
        ./cli-proxy-api &
        sleep 2
        echo -e "${GREEN}服务已启动!${NC}"

        # 尝试打开浏览器
        if [[ "$OS" == "darwin" ]]; then
            open "http://127.0.0.1:8317/management.html" 2>/dev/null
        elif command -v xdg-open &> /dev/null; then
            xdg-open "http://127.0.0.1:8317/management.html" 2>/dev/null
        fi
    fi

    # 自毁
    self_destruct
else
    echo -e "\n${RED}部署失败${NC}"
fi

echo -e "\n按 Enter 退出..."
read
