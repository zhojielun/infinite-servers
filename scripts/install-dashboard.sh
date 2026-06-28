#!/usr/bin/env bash
#
# Infinite Servers — Dashboard Installer
#
# Usage:
#   curl -fsSL ...install-dashboard.sh | sudo bash
#   curl -fsSL ...install-dashboard.sh | sudo PORT=9090 bash
#
set -euo pipefail

die()  { printf '\033[31merror:\033[0m %s\n' "$*" >&2; exit 1; }
info() { printf '\033[36m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[33mwarn:\033[0m %s\n' "$*" >&2; }

# ── determine project directory ──────────────────────────────────────
INSTALL_DIR="/opt/infinite-servers"

if [ -d "$INSTALL_DIR/server" ] && [ -f "$INSTALL_DIR/package.json" ]; then
    info "Found existing installation at $INSTALL_DIR"
elif [ -d "$INSTALL_DIR" ]; then
    warn "Directory $INSTALL_DIR exists but is incomplete."
    die "Please remove it first: sudo rm -rf $INSTALL_DIR
  Then re-run this script."
else
    info "Downloading project..."
    git clone --depth 1 https://github.com/zhojielun/infinite-servers.git "$INSTALL_DIR"
fi

PROJECT_DIR="$INSTALL_DIR"
cd "$PROJECT_DIR"

# ── check / install Node.js ─────────────────────────────────────────
info "Checking dependencies..."

has_node() { command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; }

show_node_install_help() {
    cat >&2 <<'HELPEOF'

  Node.js is required but not found. Install it manually:

  Ubuntu / Debian:
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
    sudo apt-get install -y nodejs

  CentOS / RHEL:
    curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
    sudo yum install -y nodejs

  Alpine:
    sudo apk add --no-cache nodejs npm

  After installing, re-run this script.

HELPEOF
}

if ! has_node; then
    info "Node.js not found, attempting auto-install..."

    installed_ok=false

    if command -v apt-get >/dev/null 2>&1; then
        export DEBIAN_FRONTEND=noninteractive
        if apt-get update -qq && \
           apt-get install -y -qq ca-certificates curl gnupg && \
           mkdir -p /etc/apt/keyrings && \
           curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --yes --dearmor -o /etc/apt/keyrings/nodesource.gpg 2>/dev/null && \
           echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" > /etc/apt/sources.list.d/nodesource.list && \
           apt-get update -qq && \
           apt-get install -y -qq nodejs; then
            installed_ok=true
        fi

    elif command -v yum >/dev/null 2>&1; then
        if curl -fsSL https://rpm.nodesource.com/setup_20.x | bash - && \
           yum install -y -q nodejs; then
            installed_ok=true
        fi

    elif command -v apk >/dev/null 2>&1; then
        if apk add --no-cache nodejs npm; then
            installed_ok=true
        fi
    fi

    if ! has_node; then
        warn "Auto-install failed."
        show_node_install_help
        exit 1
    fi
fi

NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
[ "$NODE_VER" -ge 18 ] || die "Node.js 18+ required (current: $(node -v)). Please upgrade Node.js."

info "Node.js $(node -v) / npm $(npm -v)"

# ── install project dependencies ────────────────────────────────────
info "Installing root dependencies..."
npm install --silent

info "Installing server dependencies..."
cd "$PROJECT_DIR/server"
npm install --silent

info "Installing web dependencies..."
cd "$PROJECT_DIR/web"
npm install --silent

# ── build frontend ──────────────────────────────────────────────────
info "Building frontend..."
cd "$PROJECT_DIR/web"
npm run build

# ── build server ────────────────────────────────────────────────────
info "Building server..."
cd "$PROJECT_DIR/server"
npm run build

# ── initialize database ────────────────────────────────────────────
info "Initializing database..."
npm run init

# ── port configuration ──────────────────────────────────────────────
PORT="${PORT:-8000}"
HOST="${HOST:-0.0.0.0}"

info "Using port: $PORT"

# ── create systemd service ─────────────────────────────────────────
info "Creating systemd service..."

NODE_PATH=$(readlink -f "$(which node)")

cat > /etc/systemd/system/infinite-dashboard.service <<EOF
[Unit]
Description=Infinite Servers Dashboard
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=$PROJECT_DIR/server
ExecStart=$NODE_PATH $PROJECT_DIR/server/dist/index.js
Restart=always
RestartSec=5
Environment=PORT=$PORT
Environment=HOST=$HOST
Environment=DATA_DIR=$PROJECT_DIR/server/data

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable infinite-dashboard

cat <<EOF

$(info "Dashboard installed successfully!")

  Project:  $PROJECT_DIR
  Server:   http://${HOST}:${PORT}
  Config:   $PROJECT_DIR/server/data/config.json
  Servers:  $PROJECT_DIR/server/data/servers.json

  Start the server:
    sudo systemctl start infinite-dashboard

  View status:
    sudo systemctl status infinite-dashboard

  View logs:
    sudo journalctl -u infinite-dashboard -f

  Restart:
    sudo systemctl restart infinite-dashboard

  Stop:
    sudo systemctl stop infinite-dashboard

  Access the dashboard:
    http://localhost:${PORT}

EOF
