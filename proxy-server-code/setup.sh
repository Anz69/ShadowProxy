#!/bin/bash

# =============================================================================
# CONFIG - Edit these before running
# =============================================================================
CORE_URL="${CORE_URL:-https://dev.shadowproxy.io/}"
AUTH_TOKEN="${AUTH_TOKEN:-}"
SERVER_ID="${SERVER_ID:-}"
PROXY_PORT="${PROXY_PORT:-10000}"
API_PORT="${API_PORT:-808}"

# Debug login: простой логин для проверки в proxy6 (1=вкл, 0=выкл)
# Upstream Mango обязателен — без него proxy6 отклонит (датацентр IP)
DEBUG_LOGIN_ENABLED="${DEBUG_LOGIN_ENABLED:-0}"
DEBUG_LOGIN="${DEBUG_LOGIN:-debug}"
DEBUG_PASSWORD="${DEBUG_PASSWORD:-debug123}"
DEBUG_UPSTREAM_HOST="${DEBUG_UPSTREAM_HOST:-}"
DEBUG_UPSTREAM_PORT="${DEBUG_UPSTREAM_PORT:-0}"
DEBUG_UPSTREAM_USER="${DEBUG_UPSTREAM_USER:-}"
DEBUG_UPSTREAM_PASSWORD="${DEBUG_UPSTREAM_PASSWORD:-}"
# =============================================================================

set -e

echo "Proxy Server V2 - Setup"
echo "Config: CORE_URL=$CORE_URL, SERVER_ID=$SERVER_ID, PROXY_PORT=$PROXY_PORT, API_PORT=$API_PORT"
echo "Debug login: $([ "$DEBUG_LOGIN_ENABLED" = "1" ] && echo "ENABLED ($DEBUG_LOGIN)" || echo "disabled")"
echo ""

if [[ $EUID -ne 0 ]]; then
   echo "Run as root: bash setup.sh"
   exit 1
fi

if [ -z "$AUTH_TOKEN" ] || [ -z "$SERVER_ID" ]; then
    echo "AUTH_TOKEN and SERVER_ID are required"
    echo "Example: AUTH_TOKEN=... SERVER_ID=203.0.113.10 bash setup.sh"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENT_DIR="$SCRIPT_DIR/src/proxy-agent"
PROXY_HOME="/root"

echo "Agent source: $AGENT_DIR"

MISSING_FILES=()
for f in main.go go.mod config.go api_server.go auth.go; do
    [ ! -f "$AGENT_DIR/$f" ] && MISSING_FILES+=("$f")
done
if [ ${#MISSING_FILES[@]} -gt 0 ]; then
    echo "Missing files: ${MISSING_FILES[*]}"
    echo "Copy full proxy-server-code-v2 folder to server before running setup"
    exit 1
fi

echo "Installing dependencies..."
apt update
apt install -y build-essential git curl wget ufw

echo "Configuring firewall..."
if command -v ufw >/dev/null 2>&1; then
    ufw allow 22/tcp 2>/dev/null || true
    ufw allow ${PROXY_PORT}/tcp 2>/dev/null || true
    ufw allow ${API_PORT}/tcp 2>/dev/null || true
    ufw --force enable 2>/dev/null || true
    ufw reload 2>/dev/null || true
fi

echo "Installing Go..."
if ! command -v go >/dev/null 2>&1; then
    cd "$PROXY_HOME"
    wget -q https://go.dev/dl/go1.21.5.linux-amd64.tar.gz
    rm -rf /usr/local/go && tar -C /usr/local -xzf go1.21.5.linux-amd64.tar.gz
    export PATH=$PATH:/usr/local/go/bin
    if ! grep -q "/usr/local/go/bin" "$PROXY_HOME/.bashrc" 2>/dev/null; then
        echo 'export PATH=$PATH:/usr/local/go/bin' >> "$PROXY_HOME/.bashrc"
    fi
else
    export PATH=$PATH:/usr/local/go/bin
fi

echo "Building agent..."
cd "$AGENT_DIR"
# Remove V1 files to avoid conflicts (agent.go, haproxy_runtime.go)
rm -f agent.go haproxy_runtime.go 2>/dev/null || true
go mod tidy
rm -f agent
go build -o agent .
chmod +x agent

if [ ! -f "agent" ]; then
    echo "Build failed"
    exit 1
fi

echo "Creating env file..."
mkdir -p /etc/default
CORE_URL_CLEAN=$(echo "$CORE_URL" | sed 's|/$||')
tee /etc/default/proxy-agent-v2 > /dev/null <<EOF
CORE_URL=$CORE_URL_CLEAN
AUTH_TOKEN=$AUTH_TOKEN
SERVER_ID=$SERVER_ID
PROXY_PORT=$PROXY_PORT
API_PORT=$API_PORT
DEBUG_LOGIN_ENABLED=$DEBUG_LOGIN_ENABLED
DEBUG_LOGIN=$DEBUG_LOGIN
DEBUG_PASSWORD=$DEBUG_PASSWORD
DEBUG_UPSTREAM_HOST=$DEBUG_UPSTREAM_HOST
DEBUG_UPSTREAM_PORT=$DEBUG_UPSTREAM_PORT
DEBUG_UPSTREAM_USER=$DEBUG_UPSTREAM_USER
DEBUG_UPSTREAM_PASSWORD=$DEBUG_UPSTREAM_PASSWORD
EOF
chmod 600 /etc/default/proxy-agent-v2

echo "Creating systemd service..."
tee /etc/systemd/system/proxy-agent-v2.service > /dev/null <<EOF
[Unit]
Description=Proxy Agent V2
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$AGENT_DIR
EnvironmentFile=-/etc/default/proxy-agent-v2
ExecStart=/bin/sh -c 'exec $AGENT_DIR/agent --core-url="\$CORE_URL" --auth-token="\$AUTH_TOKEN" --server-id="\$SERVER_ID" --proxy-port="\$PROXY_PORT" --api-port="\$API_PORT"'
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

echo "Enabling and starting service..."
systemctl daemon-reload
systemctl enable proxy-agent-v2
systemctl stop proxy-agent-v2 2>/dev/null || true
systemctl start proxy-agent-v2

sleep 3
if systemctl is-active --quiet proxy-agent-v2; then
    echo "Proxy agent v2 started successfully"
    echo "Proxy port: $PROXY_PORT, API port: $API_PORT"
else
    echo "Failed to start. Check: journalctl -u proxy-agent-v2 -f"
    exit 1
fi
