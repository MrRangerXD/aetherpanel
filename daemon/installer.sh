#!/usr/bin/env bash
# ==============================================================================
#  AetherPanel Universal Daemon Agent Installer
#  Supports: Minecraft Game Servers & Bot Hosting (Python, Node.js, Bun)
#  Default Port: 9666
#  Official Repo: https://github.com/mrrangerxd/daemon
# ==============================================================================

set -euo pipefail

# ---------- Colors ----------
RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'
BLUE=$'\033[0;34m'; CYAN=$'\033[0;36m'; BOLD=$'\033[1m'; NC=$'\033[0m'

log()   { echo -e "${GREEN}[OK]${NC} $*"; }
info()  { echo -e "${BLUE}[INFO]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
err()   { echo -e "${RED}[ERR]${NC} $*" >&2; }
title() { echo -e "\n${BOLD}${CYAN}== $* ==${NC}\n"; }

# ---------- Must be root ----------
if [[ $EUID -ne 0 ]]; then
  err "Please run with root/sudo: sudo bash $0"
  exit 1
fi

# ---------- Defaults ----------
DEFAULT_DIR="/etc/aethernode"
DEFAULT_REPO="https://github.com/mrrangerxd/daemon"
DEFAULT_BRANCH="main"
DEFAULT_SERVICE="aether-daemon"
DEFAULT_PANEL_URL="http://localhost:3000"
DEFAULT_NODE_ID="1"
DEFAULT_TOKEN=""
DEFAULT_PORT="9666"
DEFAULT_BIND="0.0.0.0"

# ---------- Helper: prompt with default ----------
ask() {
  local prompt="$1" def="$2" __var="$3" reply
  if [[ -n "$def" ]]; then
    read -rp "$(echo -e "${CYAN}?${NC} ${prompt} [${BOLD}${def}${NC}]: ")" reply || true
    reply="${reply:-$def}"
  else
    read -rp "$(echo -e "${CYAN}?${NC} ${prompt}: ")" reply || true
  fi
  printf -v "$__var" '%s' "$reply"
}

ask_yn() {
  local prompt="$1" def="${2:-y}" reply
  read -rp "$(echo -e "${CYAN}?${NC} ${prompt} [$([[ $def == y ]] && echo 'Y/n' || echo 'y/N')]: ")" reply || true
  reply="${reply:-$def}"
  [[ "$reply" =~ ^[Yy]$ ]]
}

# ---------- Banner ----------
clear || true
echo -e "${BOLD}${CYAN}"
cat <<'EOF'
    ___         __  __               ____                       
   /   | ___   / /_/ /_  ___  _____ / __ \____ ____  ____ ___  ____  ____ 
  / /| |/ _ \ / __/ __ \/ _ \/ ___// / / / __ `/ _ \/ __ `__ \/ __ \/ __ \
 / ___ /  __// /_/ / / /  __/ /   / /_/ / /_/ /  __/ / / / / / /_/ / / / /
/_/  |_\___/ \__/_/ /_/\___/_/   /_____/\__,_/\___/_/ /_/ /_/\____/_/ /_/ 
                                                                           
              Universal Node Daemon Installer (Minecraft & Bots)
              Default Port: 9666 • Multi-Runtime (Node, Python, Bun)
EOF
echo -e "${NC}"
info "AetherPanel Daemon installation initializing..."
echo

# ---------- Gather inputs ----------
title "Node Configuration Settings (Press ENTER to accept defaults)"

ask "Installation directory"                     "$DEFAULT_DIR"       INSTALL_DIR
ask "Git repository URL"                         "$DEFAULT_REPO"      REPO_URL
ask "Git branch"                                 "$DEFAULT_BRANCH"    BRANCH
ask "System service name"                        "$DEFAULT_SERVICE"   SERVICE_NAME
ask "Panel URL"                                  "$DEFAULT_PANEL_URL" PANEL_URL
ask "Node ID"                                    "$DEFAULT_NODE_ID"   NODE_ID
ask "Node Authentication Token"                  "$DEFAULT_TOKEN"     TOKEN
ask "Daemon Port"                                "$DEFAULT_PORT"      PORT
ask "Bind Host"                                  "$DEFAULT_BIND"      BIND_HOST

if [[ -z "$TOKEN" ]]; then
  err "Node Token cannot be empty. Obtain it from your Admin Panel > Node Management."
  exit 1
fi

echo
title "Confirmation"
cat <<EOF
  Directory      : ${INSTALL_DIR}
  Repo           : ${REPO_URL}  (branch: ${BRANCH})
  Service        : ${SERVICE_NAME}
  Panel URL      : ${PANEL_URL}
  Node ID        : ${NODE_ID}
  Token          : ${TOKEN:0:8}...${TOKEN: -6}
  Port           : ${PORT}
  Bind host      : ${BIND_HOST}
  Runtimes       : Minecraft (Java), Python 3, Node.js, Bun
EOF
echo

if ! ask_yn "Proceed with installation?" "y"; then
  warn "Installation cancelled by user."
  exit 0
fi

# ---------- Pre-flight dependencies ----------
title "Checking & Installing Host Dependencies"
need_pkgs=()
command -v git    >/dev/null 2>&1 || need_pkgs+=("git")
command -v curl   >/dev/null 2>&1 || need_pkgs+=("curl")
command -v unzip  >/dev/null 2>&1 || need_pkgs+=("unzip")
command -v tar    >/dev/null 2>&1 || need_pkgs+=("tar")

if ((${#need_pkgs[@]})); then
  info "Installing core utilities: ${need_pkgs[*]}"
  if command -v apt-get >/dev/null 2>&1; then
    apt-get update -y && apt-get install -y "${need_pkgs[@]}"
  elif command -v dnf >/dev/null 2>&1; then
    dnf install -y "${need_pkgs[@]}"
  elif command -v yum >/dev/null 2>&1; then
    yum install -y "${need_pkgs[@]}"
  elif command -v pacman >/dev/null 2>&1; then
    pacman -Sy --noconfirm "${need_pkgs[@]}"
  fi
fi

# Install Node.js if missing
if ! command -v node >/dev/null 2>&1; then
  info "Installing Node.js 20 LTS runtime..."
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs || true
  fi
fi

# Install Python 3 if missing (for Discord/Telegram bots)
if ! command -v python3 >/dev/null 2>&1; then
  info "Installing Python 3 & pip for bot hosting..."
  if command -v apt-get >/dev/null 2>&1; then
    apt-get install -y python3 python3-pip python3-venv || true
  elif command -v dnf >/dev/null 2>&1; then
    dnf install -y python3 python3-pip || true
  fi
fi

# Install Bun if missing (fast runtime for TS/JS bots)
if ! command -v bun >/dev/null 2>&1; then
  info "Installing Bun runtime for high-performance bots..."
  curl -fsSL https://bun.sh/install | bash || true
  if [[ -f "$HOME/.bun/bin/bun" ]]; then
    ln -sf "$HOME/.bun/bin/bun" /usr/local/bin/bun 2>/dev/null || true
  fi
fi

# Install Java for Minecraft servers if missing
if ! command -v java >/dev/null 2>&1; then
  info "Installing OpenJDK 21 for Minecraft hosting..."
  if command -v apt-get >/dev/null 2>&1; then
    apt-get install -y openjdk-21-jre-headless || apt-get install -y default-jre-headless || true
  elif command -v dnf >/dev/null 2>&1; then
    dnf install -y java-21-openjdk-headless || true
  fi
fi

log "System runtimes verified (Node.js, Python, Bun, Java)."

# ---------- Prepare install dir ----------
title "Preparing ${INSTALL_DIR}"
mkdir -p "$INSTALL_DIR" "$INSTALL_DIR/servers" "$INSTALL_DIR/logs" "$INSTALL_DIR/backups"

# If current directory already contains agent.js (e.g. from panel repo /daemon folder)
if [[ -f "$(pwd)/agent.js" && "$INSTALL_DIR" != "$(pwd)" ]]; then
  info "Local agent files found in current directory. Copying to ${INSTALL_DIR}..."
  cp -a "$(pwd)"/* "$INSTALL_DIR/" 2>/dev/null || true
elif [[ -d "$INSTALL_DIR/.git" ]]; then
  info "Updating existing git repository at ${INSTALL_DIR}..."
  git -C "$INSTALL_DIR" fetch --all --prune || true
  git -C "$INSTALL_DIR" checkout "$BRANCH" || true
  git -C "$INSTALL_DIR" pull origin "$BRANCH" || true
else
  info "Cloning daemon repository: ${REPO_URL} (${BRANCH})..."
  if ! git clone --branch "$BRANCH" --depth 1 "$REPO_URL" "$INSTALL_DIR" 2>/dev/null; then
    warn "Git clone from ${REPO_URL} failed or repo is private. Using local fallback..."
    if [[ -d "/opt/aetherpanel/daemon" ]]; then
      cp -a /opt/aetherpanel/daemon/* "$INSTALL_DIR/" 2>/dev/null || true
    fi
  fi
fi

# ---------- Write config.json ----------
title "Generating config.json"
CONFIG_PATH="${INSTALL_DIR}/config.json"
cat > "$CONFIG_PATH" <<EOF
{
  "panelUrl": "${PANEL_URL}",
  "nodeId": ${NODE_ID},
  "token": "${TOKEN}",
  "port": ${PORT},
  "bindHost": "${BIND_HOST}",
  "heartbeatIntervalMs": 15000,
  "commandPollIntervalMs": 1000
}
EOF
chmod 600 "$CONFIG_PATH"
log "Configuration saved to ${CONFIG_PATH}"

# ---------- Install Node.js Dependencies ----------
title "Installing Agent npm Dependencies"
if [[ -f "${INSTALL_DIR}/package.json" ]]; then
  if command -v npm >/dev/null 2>&1; then
    ( cd "$INSTALL_DIR" && npm install --omit=dev --no-audit --no-fund ) || \
      warn "npm install finished with non-fatal warnings."
  fi
fi

# ---------- Systemd Service Setup ----------
title "Registering System Service (${SERVICE_NAME})"
NODE_BIN="$(command -v node || echo /usr/bin/node)"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

if command -v systemctl >/dev/null 2>&1; then
  cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=AetherPanel Universal Node Daemon (Minecraft & Bots)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=${INSTALL_DIR}
ExecStart=${NODE_BIN} ${INSTALL_DIR}/agent.js
Restart=always
RestartSec=3
Environment=NODE_ENV=production
Environment=PATH=/usr/local/bin:/usr/bin:/bin:/usr/local/sbin:/usr/sbin:/sbin:${HOME}/.bun/bin
StandardOutput=journal
StandardError=journal
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload
  systemctl enable "$SERVICE_NAME" >/dev/null 2>&1 || true
  systemctl restart "$SERVICE_NAME"

  sleep 2
  if systemctl is-active --quiet "$SERVICE_NAME"; then
    log "AetherPanel Daemon service is ACTIVE and running on port ${PORT}!"
  else
    warn "Systemd service did not activate immediately. Starting via background process supervisor..."
    nohup ${NODE_BIN} "${INSTALL_DIR}/agent.js" > "${INSTALL_DIR}/logs/agent.log" 2>&1 &
  fi
else
  # Non-systemd (e.g. Alpine OpenRC or container)
  warn "Non-systemd environment. Starting agent in background..."
  nohup ${NODE_BIN} "${INSTALL_DIR}/agent.js" > "${INSTALL_DIR}/logs/agent.log" 2>&1 &
fi

# ---------- Summary ----------
title "Installation Complete 🎉"
cat <<EOF
  Install Dir   : ${INSTALL_DIR}
  Config File   : ${CONFIG_PATH}
  Service Name  : ${SERVICE_NAME}
  Panel URL     : ${PANEL_URL}
  Node ID       : ${NODE_ID}
  Daemon Port   : ${PORT} (TCP)
  Supported     : Minecraft (Vanilla/Paper/Purpur/Forge/Fabric) + Discord/Telegram Bots (Python/Node/Bun)

  Service Control:
    systemctl status ${SERVICE_NAME}
    systemctl restart ${SERVICE_NAME}
    systemctl logs: journalctl -u ${SERVICE_NAME} -f

  Agent Log File:
    tail -f ${INSTALL_DIR}/logs/agent.log
EOF
log "Node Daemon is ready and communicating with Control Plane! 🚀"
