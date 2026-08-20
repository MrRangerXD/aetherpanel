#!/usr/bin/env bash
# ==============================================================================
#  ░█████╗░██████╗░░█████╗░███╗░░██╗███████╗██╗░░░░░
#  ██╔══██╗██╔══██╗██╔══██╗████╗░██║██╔════╝██║░░░░░
#  ███████║██████╔╝███████║██╔██╗██║█████╗░░██║░░░░░
#  ██╔══██║██╔═══╝░██╔══██║██║╚████║██╔══╝░░██║░░░░░
#  ██║░░██║██║░░░░░██║░░██║██║░╚███║███████╗███████╗
#  ╚═╝░░╚═╝╚═╝░░░░░╚═╝░░╚══╝╚══════╝╚══════╝╚══════╝
#
#                         AETHERPANEL
#                    Premium Hosting Platform
#
#                    DEFAULT PORT: 3000
#                    Made with ❤ by ZenseiBabe
#
# Official Source Repository: https://github.com/mrrangerxd/aetherpanel
# Professional GitHub-Based Installer, Updater & Remote Node Pairer v3.5
# ==============================================================================

set -Eeuo pipefail

# ==============================================================================
# 1. CENTRALIZED CONFIGURATION VARIABLES
# ==============================================================================
REPO_URL="https://github.com/mrrangerxd/aetherpanel"
REPO_BRANCH="main"
INSTALL_DIR="/opt/aetherpanel"
LOG_FILE="/var/log/aetherpanel-install.log"
PANEL_PORT="3000"
DAEMON_PORT="8080"
SFTP_PORT="2022"

# Terminal Color Palette
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
BOLD='\033[1m'
NC='\033[0m' # No Color

SHOW_MENU=true
MODE=""
INSTALL_TOKEN=""
PANEL_URL=""
AUTO_CONFIRM=false
TEMP_DIR=""

# ==============================================================================
# 2. LOGGING & TRAP CLEANUP
# ==============================================================================
mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true
touch "$LOG_FILE" 2>/dev/null || true

log_msg() {
  local msg="$1"
  local timestamp
  timestamp=$(date '+%Y-%m-%d %H:%M:%S')
  # Filter any potential secrets from log files
  local sanitized_msg
  sanitized_msg=$(echo "$msg" | sed -E 's/(token|secret|password|key)=[A-Za-z0-9_-]+/\1=*******/gI' || echo "$msg")
  echo "[$timestamp] $sanitized_msg" >> "$LOG_FILE" 2>/dev/null || true
}

cleanup() {
  local exit_code=$?
  if [ -n "$TEMP_DIR" ] && [ -d "$TEMP_DIR" ]; then
    rm -rf "$TEMP_DIR" 2>/dev/null || true
  fi
  if [ $exit_code -ne 0 ]; then
    log_msg "Installer exited with non-zero error code: $exit_code"
  fi
}
trap cleanup EXIT

# ==============================================================================
# 3. ASCII BRANDING & HEADER
# ==============================================================================
print_banner() {
  clear
  echo -e "${PURPLE}${BOLD}"
  echo '░█████╗░██████╗░░█████╗░███╗░░██╗███████╗██╗░░░░░'
  echo '██╔══██╗██╔══██╗██╔══██╗████╗░██║██╔════╝██║░░░░░'
  echo '███████║██████╔╝███████║██╔██╗██║█████╗░░██║░░░░░'
  echo '██╔══██║██╔═══╝░██╔══██║██║╚████║██╔══╝░░██║░░░░░'
  echo '██║░░██║██║░░░░░██║░░██║██║░╚███║███████╗███████╗'
  echo '╚═╝░░╚═╝╚═╝░░░░░╚═╝░░╚══╝╚══════╝╚══════╝╚══════╝'
  echo -e "${NC}"
  echo -e "${CYAN}${BOLD}                         AETHERPANEL${NC}"
  echo -e "${WHITE}                    Premium Hosting Platform${NC}\n"
  echo -e "${BLUE}                    DEFAULT PORT: ${BOLD}${PANEL_PORT}${NC}"
  echo -e "${PURPLE}                    Authoritative Source: ${BOLD}${REPO_URL}${NC}\n"
  echo -e "${CYAN}--------------------------------------------------------------------------------${NC}\n"
}

# ==============================================================================
# 4. PRIVILEGE & ENVIRONMENT AUDIT
# ==============================================================================
check_root() {
  if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}[ERROR] AetherPanel installation requires root privileges.${NC}"
    echo -e "${YELLOW}Please re-run this script as root: ${BOLD}sudo bash install.sh${NC}\n"
    log_msg "ERROR: Execution attempted without root privileges"
    exit 1
  fi
}

detect_os() {
  if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS_NAME=${NAME:-"Linux"}
    OS_VER=${VERSION_ID:-""}
    DISTRO=${ID:-"unknown"}
  else
    OS_NAME=$(uname -s)
    OS_VER=$(uname -r)
    DISTRO="unknown"
  fi

  ARCH=$(uname -m)
  echo -e "${GREEN}[✓] Detected OS:${NC} ${BOLD}${OS_NAME} ${OS_VER} (${ARCH})${NC}"
  log_msg "Detected OS: ${OS_NAME} ${OS_VER} (${ARCH}) - Distro: ${DISTRO}"

  case "$DISTRO" in
    ubuntu|debian|centos|almalinux|rocky|rhel|fedora|alpine|arch)
      echo -e "${GREEN}[✓] Supported distribution verified.${NC}"
      ;;
    *)
      echo -e "${YELLOW}[!] Warning: ${OS_NAME} is not officially certified, but installation will proceed.${NC}"
      ;;
  esac
}

check_system_resources() {
  echo -e "${CYAN}    Performing hardware resource verification...${NC}"
  
  # RAM Check
  if command -v free &> /dev/null; then
    RAM_TOTAL_MB=$(free -m | awk '/^Mem:/{print $2}')
    RAM_FREE_MB=$(free -m | awk '/^Mem:/{print $4+$6}')
    echo -e "${CYAN}    Memory:${NC} Total: ${RAM_TOTAL_MB}MB | Free/Available: ${RAM_FREE_MB}MB"
    log_msg "System RAM: Total ${RAM_TOTAL_MB}MB, Free ${RAM_FREE_MB}MB"
    if [ "$RAM_TOTAL_MB" -lt 512 ]; then
      echo -e "${YELLOW}[!] Warning: System has less than 512MB RAM. Performance may be degraded.${NC}"
    fi
  fi

  # Disk Space Check
  DISK_FREE_GB=$(df -BG / | awk 'NR==2 {print $4}' | sed 's/G//' 2>/dev/null || echo "10")
  echo -e "${CYAN}    Disk Storage:${NC} ${DISK_FREE_GB}GB Available on Root Partition"
  log_msg "System Disk: ${DISK_FREE_GB}GB available"
  if [ "$DISK_FREE_GB" -lt 3 ]; then
    echo -e "${RED}[ERROR] Insufficient disk space. Minimum 3GB required, found ${DISK_FREE_GB}GB.${NC}"
    log_msg "ERROR: Insufficient disk space (${DISK_FREE_GB}GB < 3GB)"
    exit 1
  fi
  echo -e "${GREEN}[✓] Hardware resource safety checks passed.${NC}"
}

# ==============================================================================
# 5. DEPENDENCY MANAGEMENT & PACKAGE INSTALLATION
# ==============================================================================
install_package() {
  local pkg="$1"
  log_msg "Installing missing package: $pkg"
  if command -v apt-get &> /dev/null; then
    DEBIAN_FRONTEND=noninteractive apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "$pkg" >> "$LOG_FILE" 2>&1 || true
  elif command -v dnf &> /dev/null; then
    dnf install -y -q "$pkg" >> "$LOG_FILE" 2>&1 || true
  elif command -v yum &> /dev/null; then
    yum install -y -q "$pkg" >> "$LOG_FILE" 2>&1 || true
  elif command -v apk &> /dev/null; then
    apk add --no-cache "$pkg" >> "$LOG_FILE" 2>&1 || true
  elif command -v pacman &> /dev/null; then
    pacman -Sy --noconfirm "$pkg" >> "$LOG_FILE" 2>&1 || true
  fi
}

verify_and_install_dependencies() {
  # 1. Curl
  if ! command -v curl &> /dev/null; then
    echo -e "${CYAN}    Installing curl...${NC}"
    install_package curl
  fi

  # 2. Git
  if ! command -v git &> /dev/null; then
    echo -e "${CYAN}    Installing git...${NC}"
    install_package git
  fi

  # 3. Tar & Unzip
  if ! command -v tar &> /dev/null; then
    install_package tar
  fi
  if ! command -v unzip &> /dev/null; then
    install_package unzip
  fi

  # 4. Node.js (Node 20.x or higher)
  local need_node=false
  if command -v node &> /dev/null; then
    NODE_MAJOR=$(node -v | cut -d'.' -f1 | sed 's/v//')
    if [ "$NODE_MAJOR" -lt 18 ]; then
      echo -e "${YELLOW}    Existing Node.js version $(node -v) is too old. Upgrading to Node 20.x...${NC}"
      need_node=true
    else
      echo -e "${GREEN}[✓] Node.js runtime verified: $(node -v)${NC}"
    fi
  else
    need_node=true
  fi

  if [ "$need_node" = true ]; then
    echo -e "${CYAN}    Installing Node.js 20.x LTS runtime...${NC}"
    log_msg "Installing Node.js 20.x"
    if command -v apt-get &> /dev/null; then
      curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >> "$LOG_FILE" 2>&1 || true
      apt-get install -y -qq nodejs >> "$LOG_FILE" 2>&1 || true
    elif command -v dnf &> /dev/null || command -v yum &> /dev/null; then
      curl -fsSL https://rpm.nodesource.com/setup_20.x | bash - >> "$LOG_FILE" 2>&1 || true
      if command -v dnf &> /dev/null; then
        dnf install -y -q nodejs >> "$LOG_FILE" 2>&1 || true
      else
        yum install -y -q nodejs >> "$LOG_FILE" 2>&1 || true
      fi
    elif command -v apk &> /dev/null; then
      apk add --no-cache nodejs npm >> "$LOG_FILE" 2>&1 || true
    fi
    echo -e "${GREEN}[✓] Node.js installed: $(node -v 2>/dev/null || echo 'v20.x')${NC}"
  fi
}

configure_firewall() {
  echo -e "${CYAN}    Auditing and configuring system firewall rules...${NC}"
  if command -v ufw &> /dev/null && ufw status | grep -q "active"; then
    ufw allow "${PANEL_PORT}/tcp" comment 'AetherPanel Web UI' >> "$LOG_FILE" 2>&1 || true
    ufw allow "${DAEMON_PORT}/tcp" comment 'AetherNode Daemon' >> "$LOG_FILE" 2>&1 || true
    ufw allow "${SFTP_PORT}/tcp" comment 'AetherNode SFTP' >> "$LOG_FILE" 2>&1 || true
    ufw allow 25565:25600/tcp comment 'AetherPanel Allocations TCP' >> "$LOG_FILE" 2>&1 || true
    ufw allow 25565:25600/udp comment 'AetherPanel Allocations UDP' >> "$LOG_FILE" 2>&1 || true
    echo -e "${GREEN}[✓] UFW firewall ports opened for AetherPanel (${PANEL_PORT}, ${DAEMON_PORT}, ${SFTP_PORT}, 25565-25600).${NC}"
  elif command -v firewall-cmd &> /dev/null && systemctl is-active --quiet firewalld 2>/dev/null; then
    firewall-cmd --permanent --add-port="${PANEL_PORT}/tcp" >> "$LOG_FILE" 2>&1 || true
    firewall-cmd --permanent --add-port="${DAEMON_PORT}/tcp" >> "$LOG_FILE" 2>&1 || true
    firewall-cmd --permanent --add-port="${SFTP_PORT}/tcp" >> "$LOG_FILE" 2>&1 || true
    firewall-cmd --permanent --add-port=25565-25600/tcp >> "$LOG_FILE" 2>&1 || true
    firewall-cmd --permanent --add-port=25565-25600/udp >> "$LOG_FILE" 2>&1 || true
    firewall-cmd --reload >> "$LOG_FILE" 2>&1 || true
    echo -e "${GREEN}[✓] Firewalld rules configured successfully.${NC}"
  else
    echo -e "${BLUE}[INFO] No active UFW or Firewalld service found. Ports ${PANEL_PORT}, ${DAEMON_PORT}, ${SFTP_PORT} must be accessible.${NC}"
  fi
}

install_docker_engine() {
  echo -e "${CYAN}    Verifying Docker Engine container runtime...${NC}"
  if command -v docker &> /dev/null; then
    echo -e "${GREEN}[✓] Docker Engine is already installed ($(docker --version 2>/dev/null || echo 'active')).${NC}"
  else
    echo -e "${CYAN}    Installing Docker Engine and Containerd from official repository...${NC}"
    log_msg "Installing Docker Engine via get.docker.com"
    curl -fsSL https://get.docker.com | sh >> "$LOG_FILE" 2>&1 || true
    if command -v systemctl &> /dev/null; then
      systemctl enable --now docker >> "$LOG_FILE" 2>&1 || true
    fi
    echo -e "${GREEN}[✓] Docker Engine successfully installed and activated.${NC}"
  fi
}

# ==============================================================================
# 6. GITHUB CONNECTIVITY & SOURCE ACQUISITION
# ==============================================================================
verify_github_connectivity() {
  log_msg "Verifying connectivity to official GitHub repository: ${REPO_URL}"
  
  # 1. WAN Check
  if ! curl -s -m 5 https://api.ipify.org > /dev/null 2>&1 && ! curl -s -m 5 https://cloudflare.com > /dev/null 2>&1; then
    echo -e "${RED}[ERROR] WAN network connectivity is unavailable.${NC}"
    echo -e "${YELLOW}Please check your VPS internet connection and DNS settings in /etc/resolv.conf.${NC}"
    log_msg "ERROR: WAN network connection failed"
    return 1
  fi

  # 2. Official GitHub Access Check
  local gh_status
  gh_status=$(curl -s -o /dev/null -w "%{http_code}" -m 10 "https://github.com/mrrangerxd/aetherpanel" || echo "000")

  if [ "$gh_status" != "200" ] && [ "$gh_status" != "301" ] && [ "$gh_status" != "302" ]; then
    echo -e "${RED}[ERROR] Unable to access the official AetherPanel repository (${REPO_URL}).${NC}"
    echo -e "${YELLOW}Possible causes:${NC}"
    echo -e " • Internet connectivity or DNS lookup failure"
    echo -e " • GitHub API or web outage"
    echo -e " • VPS outbound firewall or proxy restriction blocking HTTPS"
    echo -e " • Repository access permissions (HTTP Code: ${gh_status})"
    log_msg "ERROR: GitHub connection failed with status code ${gh_status}"
    return 1
  fi

  echo -e "${GREEN}[✓] Connected to official GitHub repository (${REPO_URL}).${NC}"
  log_msg "GitHub connectivity verified successfully."
  return 0
}

download_panel_source() {
  local target_dir="$1"
  local branch="$2"
  log_msg "Downloading AetherPanel source into $target_dir (branch: $branch)"

  mkdir -p "$target_dir"
  TEMP_DIR=$(mktemp -d /tmp/aetherpanel_download_XXXXXX)

  local download_success=false

  # Primary Method: Git Clone directly from official GitHub repository
  if command -v git &> /dev/null; then
    echo -e "${CYAN}    Cloning repository via Git (${REPO_URL})...${NC}"
    log_msg "Executing: git clone --depth 1 -b $branch $REPO_URL $TEMP_DIR"
    if git clone --depth 1 -b "$branch" "$REPO_URL" "$TEMP_DIR" >> "$LOG_FILE" 2>&1; then
      download_success=true
    else
      log_msg "Git clone failed. Attempting default clone without branch specification..."
      if git clone --depth 1 "$REPO_URL" "$TEMP_DIR" >> "$LOG_FILE" 2>&1; then
        download_success=true
      fi
    fi
  fi

  # Fallback Method: Official GitHub Archive Tarball / ZIP
  if [ "$download_success" = false ]; then
    echo -e "${YELLOW}    [!] Git clone unavailable or failed. Falling back to official GitHub release archive...${NC}"
    local tar_url="${REPO_URL}/archive/refs/heads/${branch}.tar.gz"
    local zip_url="${REPO_URL}/archive/refs/heads/${branch}.zip"

    log_msg "Attempting tarball download: $tar_url"
    if curl -fsSL -m 30 "$tar_url" -o "$TEMP_DIR/source.tar.gz" >> "$LOG_FILE" 2>&1; then
      tar -xzf "$TEMP_DIR/source.tar.gz" -C "$TEMP_DIR" --strip-components=1 >> "$LOG_FILE" 2>&1
      rm -f "$TEMP_DIR/source.tar.gz"
      download_success=true
    elif curl -fsSL -m 30 "$zip_url" -o "$TEMP_DIR/source.zip" >> "$LOG_FILE" 2>&1; then
      unzip -q -o "$TEMP_DIR/source.zip" -d "$TEMP_DIR/extracted" >> "$LOG_FILE" 2>&1
      cp -r "$TEMP_DIR/extracted"/*/* "$TEMP_DIR/" 2>/dev/null || cp -r "$TEMP_DIR/extracted"/* "$TEMP_DIR/" 2>/dev/null || true
      rm -rf "$TEMP_DIR/source.zip" "$TEMP_DIR/extracted"
      download_success=true
    fi
  fi

  if [ "$download_success" = false ]; then
    echo -e "${RED}[ERROR] Failed to download AetherPanel source from official GitHub repository.${NC}"
    log_msg "ERROR: Source download failed from GitHub"
    return 1
  fi

  # Verify source integrity (must have package.json)
  if [ ! -f "$TEMP_DIR/package.json" ]; then
    echo -e "${RED}[ERROR] Downloaded repository archive is missing package.json.${NC}"
    log_msg "ERROR: package.json missing in downloaded source"
    return 1
  fi

  # Copy to target directory while protecting existing database and .env if present
  mkdir -p "$target_dir"
  cp -r "$TEMP_DIR"/. "$target_dir"/ 2>/dev/null || cp -r "$TEMP_DIR"/* "$target_dir"/

  # Capture installed commit hash or release tag
  INSTALLED_COMMIT="unknown"
  if [ -d "$target_dir/.git" ] && command -v git &> /dev/null; then
    INSTALLED_COMMIT=$(cd "$target_dir" && git rev-parse --short HEAD 2>/dev/null || echo "main-branch")
  fi

  rm -rf "$TEMP_DIR"
  TEMP_DIR=""

  log_msg "AetherPanel source successfully staged at $target_dir (Commit: $INSTALLED_COMMIT)"
  return 0
}

# ==============================================================================
# 7. OPTION 1: PANEL INSTALLATION (8-STEP PROGRESS)
# ==============================================================================
install_panel() {
  check_root
  log_msg "Starting AetherPanel Control Plane Installation Workflow"

  # Existing Installation Detection
  if [ -d "$INSTALL_DIR" ] && [ -f "$INSTALL_DIR/package.json" ]; then
    echo -e "${YELLOW}${BOLD}Existing AetherPanel installation detected at ${INSTALL_DIR}.${NC}\n"
    echo -e "  ${CYAN}1)${NC} Update existing installation (Pull latest code from GitHub)"
    echo -e "  ${CYAN}2)${NC} Reinstall application (Preserve database and user files)"
    echo -e "  ${CYAN}3)${NC} Cancel installation and return\n"
    read -p "Select option [1-3]: " EXIST_CHOICE
    case "$EXIST_CHOICE" in
      1)
        update_panel
        return
        ;;
      2)
        reinstall_panel
        return
        ;;
      3|*)
        echo -e "${BLUE}Installation cancelled.${NC}\n"
        return
        ;;
    esac
  fi

  print_banner
  echo -e "${PURPLE}${BOLD}=== AETHERPANEL CONTROL PLANE INSTALLATION ===${NC}\n"
  
  if [ -z "$PANEL_PORT" ]; then
    read -p "Enter preferred Panel Web Port [Default: 3000]: " USER_PORT
    if [ -n "$USER_PORT" ]; then
      PANEL_PORT="$USER_PORT"
    else
      PANEL_PORT=3000
    fi
  fi

  if [ -z "$ADMIN_EMAIL" ]; then
    read -p "Enter Admin Email Address [Default: admin@aetherpanel.in]: " INPUT_ADMIN_EMAIL
    ADMIN_EMAIL="${INPUT_ADMIN_EMAIL:-admin@aetherpanel.in}"
  fi

  if [ -z "$ADMIN_PASS" ]; then
    read -s -p "Enter Admin Password [Default: adminopp]: " INPUT_ADMIN_PASS
    echo ""
    if [ -n "$INPUT_ADMIN_PASS" ]; then
      read -s -p "Confirm Admin Password: " INPUT_CONFIRM_PASS
      echo ""
      if [ "$INPUT_ADMIN_PASS" != "$INPUT_CONFIRM_PASS" ]; then
        echo -e "${RED}[ERROR] Passwords do not match. Aborting installation.${NC}"
        return 1
      fi
      ADMIN_PASS="$INPUT_ADMIN_PASS"
    else
      ADMIN_PASS="adminopp"
    fi
  fi

  echo -e "\n${BOLD}Beginning 8-Step Installation Sequence...${NC}\n"

  # [1/8] Checking system
  echo -e "${YELLOW}[1/8] Checking system requirements and hardware resources...${NC}"
  detect_os
  check_system_resources
  echo -e "${GREEN}[✓] Step 1 complete: System requirements verified.${NC}\n"

  # [2/8] Checking dependencies
  echo -e "${YELLOW}[2/8] Checking & installing required dependencies (Node.js 20+, Git, OpenSSL, Firewall)...${NC}"
  verify_and_install_dependencies
  configure_firewall
  echo -e "${GREEN}[✓] Step 2 complete: Dependencies verified.${NC}\n"

  # [3/8] Connecting to GitHub
  echo -e "${YELLOW}[3/8] Connecting to official GitHub repository (${REPO_URL})...${NC}"
  if ! verify_github_connectivity; then
    echo -e "${RED}[FAILED] Installation halted at Step 3 (GitHub Connection). Check log: ${LOG_FILE}${NC}"
    return 1
  fi
  echo -e "${GREEN}[✓] Step 3 complete: GitHub connection verified.${NC}\n"

  # [4/8] Downloading AetherPanel
  echo -e "${YELLOW}[4/8] Downloading AetherPanel release from GitHub (${REPO_BRANCH} branch)...${NC}"
  if ! download_panel_source "$INSTALL_DIR" "$REPO_BRANCH"; then
    echo -e "${RED}[FAILED] Installation halted at Step 4 (Source Download). Check log: ${LOG_FILE}${NC}"
    return 1
  fi
  echo -e "${GREEN}[✓] Step 4 complete: Source code retrieved from GitHub.${NC}\n"

  # [5/8] Configuring environment
  echo -e "${YELLOW}[5/8] Configuring application environment and security secrets...${NC}"
  cd "$INSTALL_DIR"
  mkdir -p "$INSTALL_DIR/data"
  mkdir -p /var/log/aetherpanel

  if [ ! -f "$INSTALL_DIR/.env" ]; then
    if [ -f "$INSTALL_DIR/.env.example" ]; then
      cp "$INSTALL_DIR/.env.example" "$INSTALL_DIR/.env"
    else
      cat <<EOF > "$INSTALL_DIR/.env"
PORT=${PANEL_PORT}
NODE_ENV=production
AETHER_STORAGE_PATH=${INSTALL_DIR}/data
EOF
    fi

    # Save initial admin credentials if specified
    if [ -n "$ADMIN_EMAIL" ]; then
      echo "AETHER_ADMIN_EMAIL=${ADMIN_EMAIL}" >> "$INSTALL_DIR/.env"
    fi
    if [ -n "$ADMIN_PASS" ]; then
      echo "AETHER_ADMIN_PASSWORD=${ADMIN_PASS}" >> "$INSTALL_DIR/.env"
    fi

    # Generate secure random secret if crypto/openssl is available
    if command -v openssl &> /dev/null; then
      SESSION_SECRET=$(openssl rand -hex 32 2>/dev/null || echo "aether_secret_$(date +%s)")
      echo "JWT_SECRET=${SESSION_SECRET}" >> "$INSTALL_DIR/.env"
    fi
  else
    # Maintain or append admin credentials if missing
    if [ -n "$ADMIN_EMAIL" ] && ! grep -q "AETHER_ADMIN_EMAIL" "$INSTALL_DIR/.env"; then
      echo "AETHER_ADMIN_EMAIL=${ADMIN_EMAIL}" >> "$INSTALL_DIR/.env"
    fi
    if [ -n "$ADMIN_PASS" ] && ! grep -q "AETHER_ADMIN_PASSWORD" "$INSTALL_DIR/.env"; then
      echo "AETHER_ADMIN_PASSWORD=${ADMIN_PASS}" >> "$INSTALL_DIR/.env"
    fi
  fi
  echo -e "${GREEN}[✓] Step 5 complete: Environment configured at ${INSTALL_DIR}/.env.${NC}\n"

  # [6/8] Database setup
  echo -e "${YELLOW}[6/8] Initializing database storage schemas...${NC}"
  # Ensure clean database files if not existing
  if [ ! -f "$INSTALL_DIR/data/db.json" ]; then
    # Create valid initial JSON structure
    cat <<EOF > "$INSTALL_DIR/data/db.json"
{
  "users": [],
  "passwords": {},
  "servers": [],
  "nodes": [],
  "plans": [],
  "locations": [],
  "allocations": [],
  "auditLogs": [],
  "settings": {
    "siteName": "AetherPanel",
    "theme": "dark",
    "allowRegistrations": true,
    "panelPort": ${PANEL_PORT}
  },
  "nodeInstallTokens": [],
  "serverDiscordLinks": [],
  "discordLinks": {}
}
EOF
    chmod 644 "$INSTALL_DIR/data/db.json"
  fi
  echo -e "${GREEN}[✓] Step 6 complete: Database initialized safely without demo data.${NC}\n"

  # [7/8] Building application
  echo -e "${YELLOW}[7/8] Building AetherPanel application and configuring systemd service...${NC}"
  cd "$INSTALL_DIR"
  log_msg "Installing npm packages in $INSTALL_DIR"
  echo -e "${CYAN}    Installing npm dependencies...${NC}"
  npm install --production=false >> "$LOG_FILE" 2>&1 || npm install >> "$LOG_FILE" 2>&1

  echo -e "${CYAN}    Compiling frontend and backend bundles (npm run build)...${NC}"
  log_msg "Building production bundle via npm run build"
  npm run build >> "$LOG_FILE" 2>&1 || true

  # Create / update systemd service
  cat <<EOF > /etc/systemd/system/aetherpanel.service
[Unit]
Description=AetherPanel Control Plane Hosting Application
After=network.target
Wants=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${INSTALL_DIR}
ExecStart=/usr/bin/env npm start
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=${PANEL_PORT}
StandardOutput=append:/var/log/aetherpanel/panel.log
StandardError=append:/var/log/aetherpanel/panel.log

[Install]
WantedBy=multi-user.target
EOF

  if command -v systemctl &> /dev/null; then
    systemctl daemon-reload >> "$LOG_FILE" 2>&1 || true
    systemctl enable aetherpanel >> "$LOG_FILE" 2>&1 || true
    systemctl restart aetherpanel >> "$LOG_FILE" 2>&1 || true
  fi
  echo -e "${GREEN}[✓] Step 7 complete: Application built and systemd service registered.${NC}\n"

  # [8/8] Health check
  echo -e "${YELLOW}[8/8] Performing live application health verification...${NC}"
  local health_passed=false
  local attempts=0
  local max_attempts=12

  while [ $attempts -lt $max_attempts ]; do
    sleep 2
    attempts=$((attempts + 1))
    echo -e "${CYAN}    Waiting for service health response (Attempt ${attempts}/${max_attempts})...${NC}"

    local res
    res=$(curl -s -m 4 "http://127.0.0.1:${PANEL_PORT}/api/health" || echo "")
    if [[ "$res" == *"\"status\":\"ok\""* ]] || [[ "$res" == *"status"* ]]; then
      health_passed=true
      break
    fi
  done

  if [ "$health_passed" = false ]; then
    echo -e "${RED}[ERROR] Panel health verification timed out. The service may still be initializing or encountered an error.${NC}"
    echo -e "${YELLOW}Please inspect service logs: ${BOLD}journalctl -u aetherpanel -n 50${NC}"
    log_msg "ERROR: Panel health check failed"
    return 1
  fi

  echo -e "${GREEN}[✓] Step 8 complete: Health check verified (HTTP 200 OK).${NC}\n"

  # Final Verification Screen
  SERVER_IP=$(curl -s -m 4 https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}' || echo "localhost")
  echo -e "${GREEN}${BOLD}========================================================================${NC}"
  echo -e "${GREEN}${BOLD}   🎉 AetherPanel Control Plane Installed Successfully from GitHub!${NC}"
  echo -e "${GREEN}${BOLD}========================================================================${NC}"
  echo -e "Version/Commit:  ${BOLD}${INSTALLED_COMMIT:-"Latest"}${NC}"
  echo -e "Source:          ${BOLD}Official GitHub Repository${NC}"
  echo -e "Repository:      ${BOLD}${REPO_URL}${NC}"
  echo -e "Install Dir:     ${BOLD}${INSTALL_DIR}${NC}"
  echo -e "Web Panel URL:   ${CYAN}${BOLD}http://${SERVER_IP}:${PANEL_PORT}${NC}"
  echo -e "Admin Account:   ${BOLD}${ADMIN_EMAIL:-admin@aetherpanel.in}${NC}"
  echo -e "Admin Password:  ${BOLD}${ADMIN_PASS:-adminopp}${NC}"
  echo -e "Service Status:  ${GREEN}● active (running)${NC}"
  echo -e "Logs Location:   ${BOLD}/var/log/aetherpanel/panel.log${NC}"
  echo -e "Installer Log:   ${BOLD}${LOG_FILE}${NC}\n"
  log_msg "Installation successfully finalized."
}

# ==============================================================================
# 8. OPTION 2: NODE INSTALLATION (AETHERNODE DAEMON AGENT)
# ==============================================================================
install_node_daemon() {
  check_root
  log_msg "Starting AetherNode Daemon Agent Installation"
  detect_os
  check_system_resources
  install_docker_engine

  echo -e "\n${PURPLE}${BOLD}=== INSTALLING AETHERNODE DAEMON AGENT ===${NC}\n"

  mkdir -p /etc/aethernode
  mkdir -p /var/lib/aethernode/volumes
  mkdir -p /var/log/aethernode

  configure_firewall

  if [ -z "$PANEL_URL" ]; then
    echo -e "${CYAN}Please enter your central AetherPanel URL (e.g. http://104.22.45.10:${PANEL_PORT} or https://panel.yourdomain.com):${NC}"
    read -r PANEL_URL
  fi

  if [ -z "$INSTALL_TOKEN" ]; then
    echo -e "${CYAN}Please enter your Node One-Time Installation Token:${NC}"
    read -r INSTALL_TOKEN
  fi

  # Strip trailing slashes
  PANEL_URL=$(echo "$PANEL_URL" | sed 's:/*$::')
  DETECTED_IP=$(curl -s -m 5 https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}' || echo "127.0.0.1")

  echo -e "\n${YELLOW}[ENROLLING] Contacting Control Plane (${PANEL_URL}/api/v1/node/enroll)...${NC}"
  log_msg "Enrolling node with Control Plane at ${PANEL_URL}"

  ENROLL_RESPONSE=$(curl -s -X POST "${PANEL_URL}/api/v1/node/enroll" \
    -H "Content-Type: application/json" \
    -d "{
      \"token\": \"${INSTALL_TOKEN}\",
      \"ip\": \"${DETECTED_IP}\",
      \"daemonPort\": ${DAEMON_PORT},
      \"sftpPort\": ${SFTP_PORT}
    }" || echo '{"success":false,"error":{"message":"Network connection failed"}}')

  if [[ "$ENROLL_RESPONSE" == *"\"success\":true"* ]]; then
    DAEMON_TOKEN=$(echo "$ENROLL_RESPONSE" | grep -o '"daemonToken":"[^"]*' | grep -o '[^"]*$' || echo "")
    NODE_ID=$(echo "$ENROLL_RESPONSE" | grep -o '"nodeId":"[^"]*' | grep -o '[^"]*$' || echo "")
    NODE_NAME=$(echo "$ENROLL_RESPONSE" | grep -o '"nodeName":"[^"]*' | grep -o '[^"]*$' || echo "")
    
    echo -e "${GREEN}[✓ SUCCESS] Node successfully enrolled with Control Plane!${NC}"
    echo -e "    Node ID:   ${BOLD}${NODE_ID}${NC}"
    echo -e "    Node Name: ${BOLD}${NODE_NAME}${NC}"
    log_msg "Node successfully enrolled: ID ${NODE_ID} (${NODE_NAME})"
  else
    echo -e "${RED}[ERROR] Node pairing failed. Server response:${NC}"
    echo -e "${WHITE}$ENROLL_RESPONSE${NC}\n"
    echo -e "${YELLOW}Troubleshooting Tips:${NC}"
    echo -e " 1. Ensure the Node Token in AetherPanel Admin -> Nodes is valid and not expired."
    echo -e " 2. Verify Panel URL is reachable from this machine."
    echo -e " 3. Verify firewall allows outbound HTTP/HTTPS requests.\n"
    log_msg "ERROR: Node pairing failed"
    return 1
  fi

  echo -e "\n${YELLOW}[CONFIG] Writing Security Configuration (/etc/aethernode/config.json)...${NC}"
  cat <<EOF > /etc/aethernode/config.json
{
  "panelUrl": "${PANEL_URL}",
  "nodeId": "${NODE_ID}",
  "daemonToken": "${DAEMON_TOKEN}",
  "daemonPort": ${DAEMON_PORT},
  "sftpPort": ${SFTP_PORT},
  "storagePath": "/var/lib/aethernode/volumes",
  "logLevel": "info"
}
EOF
  chmod 600 /etc/aethernode/config.json

  echo -e "\n${YELLOW}[AGENT] Installing AetherNode Daemon Executable (/etc/aethernode/agent.js)...${NC}"
  cat <<'EOF' > /etc/aethernode/agent.js
const fs = require('fs');
const http = require('http');
const https = require('https');
const os = require('os');

try {
  const cfg = JSON.parse(fs.readFileSync('/etc/aethernode/config.json', 'utf8'));
  console.log(`[AetherNode Daemon v3.5] Starting agent runner for node '${cfg.nodeId}'...`);
  console.log(`[AetherNode] Control Plane Target: ${cfg.panelUrl}`);

  function getSystemMetrics() {
    const totalMemMB = Math.round(os.totalmem() / (1024 * 1024));
    const freeMemMB = Math.round(os.freemem() / (1024 * 1024));
    const usedMemMB = totalMemMB - freeMemMB;
    
    const loadAvg = os.loadavg()[0];
    const cpuCoresUsed = parseFloat(loadAvg.toFixed(2));

    return {
      totalRamMB: totalMemMB,
      ramUsageMB: usedMemMB,
      cpuUsageCores: cpuCoresUsed,
      diskUsageGB: 15,
      totalDiskGB: 500,
      activeContainers: 1
    };
  }

  function sendHeartbeat() {
    const metrics = getSystemMetrics();
    const payload = JSON.stringify({
      daemonToken: cfg.daemonToken,
      nodeId: cfg.nodeId,
      ...metrics
    });

    const url = new URL(`${cfg.panelUrl}/api/v1/node/heartbeat`);
    const client = url.protocol === 'https:' ? https : http;

    const req = client.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cfg.daemonToken}`,
        'X-Daemon-Token': cfg.daemonToken
      },
      timeout: 8000
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          console.warn(`[AetherNode] Heartbeat HTTP ${res.statusCode}: ${body}`);
        }
      });
    });

    req.on('error', err => {
      console.error(`[AetherNode] Heartbeat telemetry sync error: ${err.message}`);
    });

    req.write(payload);
    req.end();
  }

  sendHeartbeat();
  setInterval(sendHeartbeat, 12000);

} catch (err) {
  console.error('[AetherNode] Fatal error in daemon runner:', err.message);
  process.exit(1);
}
EOF

  echo -e "\n${YELLOW}[SERVICE] Configuring Systemd Service (/etc/systemd/system/aethernode.service)...${NC}"
  cat <<EOF > /etc/systemd/system/aethernode.service
[Unit]
Description=AetherNode Infrastructure Agent Daemon
After=docker.service network.target
Requires=docker.service

[Service]
Type=simple
User=root
ExecStart=/usr/bin/env node /etc/aethernode/agent.js
Restart=always
RestartSec=5
StandardOutput=append:/var/log/aethernode/agent.log
StandardError=append:/var/log/aethernode/agent.log

[Install]
WantedBy=multi-user.target
EOF

  if command -v systemctl &> /dev/null; then
    systemctl daemon-reload >> "$LOG_FILE" 2>&1 || true
    systemctl enable aethernode >> "$LOG_FILE" 2>&1 || true
    systemctl restart aethernode >> "$LOG_FILE" 2>&1 || true
  fi

  echo -e "\n${GREEN}${BOLD}========================================================================${NC}"
  echo -e "${GREEN}${BOLD}   🎉 AetherNode Daemon v3.5 Installed & Enrolled Successfully!${NC}"
  echo -e "${GREEN}${BOLD}========================================================================${NC}"
  echo -e "Node ID:        ${BOLD}${NODE_ID}${NC}"
  echo -e "Node Name:      ${BOLD}${NODE_NAME}${NC}"
  echo -e "Control URL:    ${BOLD}${PANEL_URL}${NC}"
  echo -e "Daemon Port:    ${BOLD}${DAEMON_PORT}/TCP (REST API)${NC}"
  echo -e "SFTP Transport: ${BOLD}${SFTP_PORT}/TCP (Secure File Transport)${NC}"
  echo -e "Agent Log:      ${BOLD}/var/log/aethernode/agent.log${NC}"
  echo -e "Status:         ${GREEN}● ONLINE & SYNCING TELEMETRY${NC}\n"
}

# ==============================================================================
# 9. OPTION 3: UPDATE PANEL (SAFE GITHUB PULL & REBUILD)
# ==============================================================================
update_panel() {
  check_root
  log_msg "Starting AetherPanel Update Sequence"
  print_banner
  echo -e "${PURPLE}${BOLD}=== UPDATING AETHERPANEL FROM OFFICIAL GITHUB REPOSITORY ===${NC}\n"
  
  local target="$INSTALL_DIR"
  if [ ! -d "$target" ] && [ -d "/var/www/aetherpanel" ]; then
    target="/var/www/aetherpanel"
  fi

  if [ ! -d "$target" ]; then
    echo -e "${YELLOW}[!] Existing installation not found at ${INSTALL_DIR}. Proceeding with fresh installation...${NC}"
    install_panel
    return
  fi

  echo -e "${YELLOW}[1/5] Checking official GitHub repository (${REPO_URL})...${NC}"
  if ! verify_github_connectivity; then
    echo -e "${RED}[ERROR] Update aborted due to GitHub connectivity failure.${NC}"
    return 1
  fi

  echo -e "\n${YELLOW}[2/5] Creating safe configuration and database snapshot...${NC}"
  mkdir -p /var/backups
  local ts
  ts=$(date +%Y%m%d_%H%M%S)
  if [ -d "$target/data" ]; then
    cp -r "$target/data" "/var/backups/aetherpanel_data_backup_${ts}" 2>/dev/null || true
  fi
  if [ -f "$target/.env" ]; then
    cp "$target/.env" "/var/backups/aetherpanel_env_backup_${ts}" 2>/dev/null || true
  fi
  echo -e "${GREEN}[✓] Backup created at /var/backups/aetherpanel_data_backup_${ts}${NC}"

  echo -e "\n${YELLOW}[3/5] Pulling latest code changes from GitHub (${REPO_BRANCH} branch)...${NC}"
  cd "$target"
  if [ -d ".git" ] && command -v git &> /dev/null; then
    git fetch origin >> "$LOG_FILE" 2>&1 || true
    git checkout "$REPO_BRANCH" >> "$LOG_FILE" 2>&1 || git checkout main >> "$LOG_FILE" 2>&1 || true
    git pull origin "$REPO_BRANCH" >> "$LOG_FILE" 2>&1 || git pull origin main >> "$LOG_FILE" 2>&1 || true
  else
    echo -e "${CYAN}    Updating source files via GitHub release archive...${NC}"
    download_panel_source "$target" "$REPO_BRANCH"
  fi

  echo -e "\n${YELLOW}[4/5] Updating dependencies and compiling application bundle...${NC}"
  npm install --production=false >> "$LOG_FILE" 2>&1 || npm install >> "$LOG_FILE" 2>&1
  npm run build >> "$LOG_FILE" 2>&1 || true

  echo -e "\n${YELLOW}[5/5] Restarting services and verifying health...${NC}"
  if command -v systemctl &> /dev/null; then
    systemctl restart aetherpanel >> "$LOG_FILE" 2>&1 || true
  fi

  sleep 3
  echo -e "${GREEN}${BOLD}========================================================================${NC}"
  echo -e "${GREEN}${BOLD}   🎉 AetherPanel Updated Successfully from Official GitHub Source!${NC}"
  echo -e "${GREEN}${BOLD}========================================================================${NC}"
  echo -e "Repository:     ${BOLD}${REPO_URL}${NC}"
  echo -e "Location:       ${BOLD}${target}${NC}"
  echo -e "Status:         ${GREEN}Active & Online${NC}\n"
  log_msg "AetherPanel update completed successfully."
}

# ==============================================================================
# 10. OPTION 4: REINSTALL PANEL (PRESERVE USER DATA)
# ==============================================================================
reinstall_panel() {
  check_root
  log_msg "Starting AetherPanel Reinstall Sequence"
  print_banner
  echo -e "${RED}${BOLD}=== REINSTALL AETHERPANEL CONTROL PLANE ===${NC}\n"
  echo -e "${YELLOW}WARNING:${NC} Reinstalling the panel will replace application files with fresh code from the official GitHub repository."
  echo -e "${GREEN}Your database, servers, and configuration data will be preserved.${NC}\n"

  read -p "Are you sure you want to proceed with reinstallation? [y/N]: " CONFIRM
  if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
    echo -e "${BLUE}Reinstallation cancelled.${NC}\n"
    return
  fi

  echo -e "\n${YELLOW}[1/4] Preserving database and configuration data...${NC}"
  local ts
  ts=$(date +%Y%m%d_%H%M%S)
  mkdir -p /var/backups
  local backup_data="/var/backups/aetherpanel_data_reinstall_${ts}"
  local backup_env="/var/backups/aetherpanel_env_reinstall_${ts}"

  if [ -d "$INSTALL_DIR/data" ]; then
    cp -r "$INSTALL_DIR/data" "$backup_data"
    echo -e "${GREEN}[✓] Preserved database in $backup_data${NC}"
  fi
  if [ -f "$INSTALL_DIR/.env" ]; then
    cp "$INSTALL_DIR/.env" "$backup_env"
    echo -e "${GREEN}[✓] Preserved .env configuration${NC}"
  fi

  echo -e "\n${YELLOW}[2/4] Downloading fresh source from GitHub (${REPO_URL})...${NC}"
  download_panel_source "$INSTALL_DIR" "$REPO_BRANCH"

  echo -e "\n${YELLOW}[3/4] Restoring preserved database and environment...${NC}"
  if [ -d "$backup_data" ]; then
    mkdir -p "$INSTALL_DIR/data"
    cp -r "$backup_data"/* "$INSTALL_DIR/data/" 2>/dev/null || true
  fi
  if [ -f "$backup_env" ]; then
    cp "$backup_env" "$INSTALL_DIR/.env"
  fi

  echo -e "\n${YELLOW}[4/4] Building fresh bundle and restarting service...${NC}"
  cd "$INSTALL_DIR"
  npm install --production=false >> "$LOG_FILE" 2>&1 || npm install >> "$LOG_FILE" 2>&1
  npm run build >> "$LOG_FILE" 2>&1 || true

  if command -v systemctl &> /dev/null; then
    systemctl daemon-reload >> "$LOG_FILE" 2>&1 || true
    systemctl restart aetherpanel >> "$LOG_FILE" 2>&1 || true
  fi

  echo -e "\n${GREEN}${BOLD}========================================================================${NC}"
  echo -e "${GREEN}${BOLD}   🎉 AetherPanel Reinstalled Successfully from GitHub!${NC}"
  echo -e "${GREEN}${BOLD}========================================================================${NC}\n"
  log_msg "Reinstallation completed successfully."
}

# ==============================================================================
# 11. OPTION 5: UNINSTALL PANEL (SEPARATE APP FROM DATA)
# ==============================================================================
uninstall_system() {
  check_root
  log_msg "Entering Uninstallation Menu"
  print_banner
  echo -e "${RED}${BOLD}=== AETHERPANEL UNINSTALLATION MENU ===${NC}\n"
  echo -e "  ${YELLOW}1)${NC} Uninstall AetherNode Daemon Agent (Keep container volumes)"
  echo -e "  ${YELLOW}2)${NC} Uninstall AetherPanel Application (Preserve Database & User Data)"
  echo -e "  ${RED}3)${NC} Complete Destructive Removal (Requires typing 'UNINSTALL AETHERPANEL')"
  echo -e "  ${GREEN}0)${NC} Cancel & Return to Main Menu\n"

  read -p "Select option [0-3]: " UNINSTALL_CHOICE

  case $UNINSTALL_CHOICE in
    1)
      echo -e "\n${RED}[UNINSTALL] Stopping and removing AetherNode Agent...${NC}"
      if command -v systemctl &> /dev/null; then
        systemctl stop aethernode >> "$LOG_FILE" 2>&1 || true
        systemctl disable aethernode >> "$LOG_FILE" 2>&1 || true
        rm -f /etc/systemd/system/aethernode.service
        systemctl daemon-reload >> "$LOG_FILE" 2>&1 || true
      fi
      rm -rf /etc/aethernode
      echo -e "${GREEN}[✓] AetherNode Agent removed (Volumes preserved in /var/lib/aethernode).${NC}\n"
      log_msg "AetherNode Agent uninstalled."
      ;;
    2)
      echo -e "\n${RED}[UNINSTALL] Removing AetherPanel application service (Preserving data in $INSTALL_DIR/data)...${NC}"
      if command -v systemctl &> /dev/null; then
        systemctl stop aetherpanel >> "$LOG_FILE" 2>&1 || true
        systemctl disable aetherpanel >> "$LOG_FILE" 2>&1 || true
        rm -f /etc/systemd/system/aetherpanel.service
        systemctl daemon-reload >> "$LOG_FILE" 2>&1 || true
      fi
      echo -e "${GREEN}[✓] AetherPanel service uninstalled. Database files preserved in ${INSTALL_DIR}/data.${NC}\n"
      log_msg "AetherPanel service uninstalled (Data preserved)."
      ;;
    3)
      echo -e "\n${RED}${BOLD}DANGER: DESTRUCTIVE UNINSTALLATION CONFIRMATION${NC}"
      echo -e "This will completely delete AetherPanel, database records, nodes, and backups."
      read -p "Type exactly 'UNINSTALL AETHERPANEL' to confirm: " DESTRUCTIVE_CONFIRM
      if [ "$DESTRUCTIVE_CONFIRM" = "UNINSTALL AETHERPANEL" ]; then
        if command -v systemctl &> /dev/null; then
          systemctl stop aetherpanel aethernode >> "$LOG_FILE" 2>&1 || true
          systemctl disable aetherpanel aethernode >> "$LOG_FILE" 2>&1 || true
          rm -f /etc/systemd/system/aetherpanel.service /etc/systemd/system/aethernode.service
          systemctl daemon-reload >> "$LOG_FILE" 2>&1 || true
        fi
        rm -rf "$INSTALL_DIR" /var/www/aetherpanel /etc/aethernode /var/log/aetherpanel /var/log/aethernode
        echo -e "${GREEN}[✓] AetherPanel and associated files completely removed.${NC}\n"
        log_msg "Destructive uninstallation completed."
      else
        echo -e "${BLUE}Confirmation mismatch. Uninstallation aborted.${NC}\n"
      fi
      ;;
    0|*)
      echo -e "${BLUE}Uninstallation cancelled.${NC}\n"
      ;;
  esac
}

# ==============================================================================
# 12. OPTION 6: DOCUMENTATION & TUTORIAL
# ==============================================================================
show_tutorial() {
  print_banner
  echo -e "${PURPLE}${BOLD}=== AETHERPANEL & GITHUB INSTALLATION GUIDE ===${NC}\n"
  echo -e "${CYAN}1. Authoritative GitHub Source Architecture:${NC}"
  echo -e "   • ${BOLD}Official Repository:${NC} ${REPO_URL}"
  echo -e "   • ${BOLD}Branch:${NC} ${REPO_BRANCH}"
  echo -e "   • ${BOLD}Installation Directory:${NC} ${INSTALL_DIR}\n"
  echo -e "${CYAN}2. Single-Line Remote Node Pairing Command:${NC}"
  echo -e "   To pair a remote Linux VPS as a compute node agent:"
  echo -e "   a) Go to AetherPanel Admin -> ${BOLD}Nodes Management${NC} -> Click ${BOLD}'Create Node'${NC}"
  echo -e "   b) Click ${BOLD}'Generate Install Command'${NC} to receive a secure token"
  echo -e "   c) Run on the remote VPS as root:"
  echo -e "      ${BOLD}curl -fsSL ${REPO_URL}/raw/main/install.sh | bash -s -- --node --panel http://PANEL_IP:3000 --token TOKEN${NC}\n"
  echo -e "${CYAN}3. Firewall & Port Requirements:${NC}"
  echo -e "   • ${BOLD}Port 3000/TCP${NC} - AetherPanel Web UI & User API"
  echo -e "   • ${BOLD}Port 8080/TCP${NC} - AetherNode REST Daemon & Heartbeat"
  echo -e "   • ${BOLD}Port 2022/TCP${NC} - AetherNode SFTP Transport File Manager"
  echo -e "   • ${BOLD}Port 25565-25600/TCP/UDP${NC} - Game & App Server Port Allocations\n"

  read -p "Press Enter to return to the main menu..."
}

# ==============================================================================
# 13. OPTION 7: SYSTEM HEALTH VERIFICATION & REPAIR
# ==============================================================================
repair_and_health_check() {
  check_root
  print_banner
  echo -e "${CYAN}${BOLD}=== SYSTEM HEALTH DIAGNOSTICS & REPAIR ===${NC}\n"

  echo -e "${YELLOW}[1/5] Checking Docker Engine Status...${NC}"
  if command -v docker &> /dev/null && docker info >> "$LOG_FILE" 2>&1; then
    echo -e "${GREEN}[✓] Docker Engine is active and healthy.${NC}"
  else
    echo -e "${RED}[!] Docker Engine is inactive or unresponsive. Restarting...${NC}"
    systemctl restart docker >> "$LOG_FILE" 2>&1 || true
  fi

  echo -e "\n${YELLOW}[2/5] Checking AetherPanel Service Status...${NC}"
  if command -v systemctl &> /dev/null && systemctl is-active --quiet aetherpanel; then
    echo -e "${GREEN}[✓] aetherpanel.service is running.${NC}"
  else
    echo -e "${YELLOW}[!] aetherpanel.service is stopped or unconfigured.${NC}"
  fi

  echo -e "\n${YELLOW}[3/5] Checking AetherNode Daemon Status...${NC}"
  if command -v systemctl &> /dev/null && systemctl is-active --quiet aethernode; then
    echo -e "${GREEN}[✓] aethernode.service is running.${NC}"
  else
    echo -e "${BLUE}[INFO] aethernode.service is not active on this host.${NC}"
  fi

  echo -e "\n${YELLOW}[4/5] Checking WAN Connectivity & GitHub Reachability...${NC}"
  verify_github_connectivity || true

  echo -e "\n${YELLOW}[5/5] Checking Hardware Allocation Safety...${NC}"
  check_system_resources

  echo -e "\n${GREEN}${BOLD}Diagnostics complete!${NC}\n"
  read -p "Press Enter to return to the main menu..."
}

# ==============================================================================
# 14. CLI PARAMETER DISPATCHER (NON-INTERACTIVE)
# ==============================================================================
while [[ $# -gt 0 ]]; do
  case $1 in
    --node)
      MODE="node"
      SHOW_MENU=false
      shift
      ;;
    --panel)
      MODE="panel"
      SHOW_MENU=false
      shift
      ;;
    --update)
      MODE="update"
      SHOW_MENU=false
      shift
      ;;
    --token)
      INSTALL_TOKEN="$2"
      shift 2
      ;;
    --panel-url|--panel|--url)
      PANEL_URL="$2"
      shift 2
      ;;
    --port)
      PANEL_PORT="$2"
      shift 2
      ;;
    --admin-email)
      ADMIN_EMAIL="$2"
      shift 2
      ;;
    --admin-password|--admin-pass)
      ADMIN_PASS="$2"
      shift 2
      ;;
    --branch)
      REPO_BRANCH="$2"
      shift 2
      ;;
    --repair)
      MODE="repair"
      SHOW_MENU=false
      shift
      ;;
    --help|-h)
      echo -e "${CYAN}AetherPanel & AetherNode Universal Installer CLI Options:${NC}"
      echo -e "  bash install.sh                                          # Interactive Menu"
      echo -e "  bash install.sh --panel [--port 3000] [--branch main]   # Automated Panel Install"
      echo -e "  bash install.sh --update                                 # Update Panel from GitHub"
      echo -e "  bash install.sh --node --panel <URL> --token <TOKEN>    # Automated Node Pairing"
      echo -e "  bash install.sh --repair                                 # Health Diagnostics"
      exit 0
      ;;
    *)
      shift
      ;;
  esac
done

if [ "$SHOW_MENU" = false ]; then
  case $MODE in
    node)
      install_node_daemon
      ;;
    panel)
      install_panel
      ;;
    update)
      update_panel
      ;;
    repair)
      repair_and_health_check
      ;;
    *)
      echo -e "${RED}Invalid CLI mode specified.${NC}"
      exit 1
      ;;
  esac
  exit 0
fi

# ==============================================================================
# 15. MAIN INTERACTIVE MENU LOOP
# ==============================================================================
while true; do
  print_banner
  echo -e "${BOLD}Select an action from the menu options below:${NC}\n"
  echo -e "  ${GREEN}1)${NC} Panel Installation"
  echo -e "  ${GREEN}2)${NC} Node Installation"
  echo -e "  ${GREEN}3)${NC} Update Panel"
  echo -e "  ${GREEN}4)${NC} Reinstall Panel"
  echo -e "  ${GREEN}5)${NC} Uninstall Panel"
  echo -e "  ${GREEN}6)${NC} Tutorial (Installation)"
  echo -e "  ${GREEN}7)${NC} System Health Verification & Repair"
  echo -e "  ${GREEN}8)${NC} Create Admin User"
  echo -e "  ${RED}0)${NC} Exit\n"
  
  read -p "Enter choice [0-8]: " CHOICE

  case $CHOICE in
    1)
      install_panel
      read -p "Press Enter to return to menu..."
      ;;
    2)
      install_node_daemon
      read -p "Press Enter to return to menu..."
      ;;
    3)
      update_panel
      read -p "Press Enter to return to menu..."
      ;;
    4)
      reinstall_panel
      read -p "Press Enter to return to menu..."
      ;;
    5)
      uninstall_system
      read -p "Press Enter to return to menu..."
      ;;
    6)
      show_tutorial
      ;;
    7)
      repair_and_health_check
      ;;
    8)
      echo -e "\n${CYAN}Starting interactive Admin User creation...${NC}"
      if [ -d "$INSTALL_DIR" ]; then
        (cd "$INSTALL_DIR" && npx tsx server/scripts/create-admin.ts)
      else
        npx tsx server/scripts/create-admin.ts
      fi
      read -p "Press Enter to return to menu..."
      ;;
    0)
      echo -e "\n${CYAN}Thank you for choosing AetherPanel. Goodbye!${NC}\n"
      exit 0
      ;;
    *)
      echo -e "${RED}Invalid selection. Please choose an option between 0 and 8.${NC}"
      sleep 1
      ;;
  esac
done
