#!/usr/bin/env bash
#
# Evodactyl Panel — native installer.
#
# Installs the panel directly on the host with systemd, MariaDB, and Redis.
# Supports Ubuntu 22.04+, Debian 12+, Rocky/Alma 9+, and RHEL 9+.
#
# Recommended usage: download first, then run.
#
#   curl -fsSL -o install.sh https://raw.githubusercontent.com/Evodactyl/evodactyl-panel/main/scripts/install.sh
#   sudo bash install.sh
#
# The pipe form also works on most hosts:
#
#   curl -fsSL https://raw.githubusercontent.com/Evodactyl/evodactyl-panel/main/scripts/install.sh | sudo bash
#
# Environment overrides (optional):
#   EVODACTYL_INSTALL_DIR   default /srv/evodactyl
#   EVODACTYL_REPO          default https://github.com/Evodactyl/evodactyl-panel.git
#   EVODACTYL_BRANCH        default main

set -euo pipefail

# Reopen stdin on the controlling TTY so `curl ... | sudo bash` still gets
# interactive prompts.
if [ ! -t 0 ]; then
    if [ -e /dev/tty ] && exec < /dev/tty 2>/dev/null; then
        : # TTY reopened; interactive prompts will work
    else
        cat <<'TTY_FAIL' >&2
✗ This script needs an interactive terminal to prompt for configuration,
  but stdin isn't a TTY and /dev/tty isn't accessible.

  Download the script and run it directly instead:

      curl -fsSL -o install.sh https://raw.githubusercontent.com/Evodactyl/evodactyl-panel/main/scripts/install.sh
      sudo bash install.sh

TTY_FAIL
        exit 1
    fi
fi

# ───── preflight ─────
command -v openssl >/dev/null || { echo "✗ openssl is required"; exit 1; }
command -v curl >/dev/null    || { echo "✗ curl is required";    exit 1; }
[ "$(id -u)" -eq 0 ]          || { echo "✗ run as root (or via sudo)"; exit 1; }

INSTALL_DIR="${EVODACTYL_INSTALL_DIR:-/srv/evodactyl}"
REPO_URL="${EVODACTYL_REPO:-https://github.com/Evodactyl/evodactyl-panel.git}"
REPO_BRANCH="${EVODACTYL_BRANCH:-main}"
BUN_VERSION="1.3"

# ───── OS detection ─────
detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS_ID="${ID,,}"
        OS_VERSION="${VERSION_ID%%.*}"
    else
        echo "✗ Cannot detect OS (no /etc/os-release). Supported: Ubuntu 22+, Debian 12+, Rocky/Alma/RHEL 9+"
        exit 1
    fi

    case "$OS_ID" in
        ubuntu)
            [ "$OS_VERSION" -ge 22 ] || { echo "✗ Ubuntu 22.04+ required (found $VERSION_ID)"; exit 1; }
            PKG_MANAGER="apt"
            ;;
        debian)
            [ "$OS_VERSION" -ge 12 ] || { echo "✗ Debian 12+ required (found $VERSION_ID)"; exit 1; }
            PKG_MANAGER="apt"
            ;;
        rocky|almalinux|rhel)
            [ "$OS_VERSION" -ge 9 ] || { echo "✗ $NAME 9+ required (found $VERSION_ID)"; exit 1; }
            PKG_MANAGER="dnf"
            ;;
        *)
            echo "✗ Unsupported OS: $PRETTY_NAME"
            echo "  Supported: Ubuntu 22+, Debian 12+, Rocky/Alma/RHEL 9+"
            exit 1
            ;;
    esac
}

# ───── helpers ─────
ask() {
    local __var="$1" __label="$2" __default="${3:-}" __reply
    while :; do
        if [ -n "$__default" ]; then
            printf "  %s [%s]: " "$__label" "$__default"
        else
            printf "  %s: " "$__label"
        fi
        IFS= read -r __reply || __reply=""
        [ -z "$__reply" ] && __reply="$__default"
        if [ -z "$__reply" ]; then echo "    ! cannot be empty"; continue; fi
        printf -v "$__var" '%s' "$__reply"
        return
    done
}
ask_secret() {
    local __var="$1" __label="$2" __a __b
    while :; do
        printf "  %s: " "$__label";    IFS= read -rs __a || __a=""; echo
        printf "  confirm: ";          IFS= read -rs __b || __b=""; echo
        if [ -z "$__a" ];        then echo "    ! cannot be empty";  continue; fi
        if [ "$__a" != "$__b" ]; then echo "    ! did not match";    continue; fi
        if [ ${#__a} -lt 8 ];    then echo "    ! min 8 characters"; continue; fi
        if ! echo "$__a" | grep -qE '[A-Z]' \
            || ! echo "$__a" | grep -qE '[a-z]' \
            || ! echo "$__a" | grep -qE '[0-9]'; then
            echo "    ! must contain upper, lower, and a digit"; continue
        fi
        printf -v "$__var" '%s' "$__a"
        return
    done
}
confirm() {
    local __label="$1" __default="${2:-n}" __reply
    printf "  %s [%s/%s] " "$__label" \
        "$([ "$__default" = y ] && echo Y || echo y)" \
        "$([ "$__default" = n ] && echo N || echo n)"
    IFS= read -r __reply || __reply=""
    [ -z "$__reply" ] && __reply="$__default"
    case "$__reply" in y|Y|yes|YES) return 0 ;; *) return 1 ;; esac
}

# ───── package installation ─────
install_packages_apt() {
    echo "  → updating package lists"
    apt-get update -qq

    echo "  → installing system dependencies"
    apt-get install -y -qq \
        curl git unzip openssl \
        mariadb-server redis-server \
        nginx certbot python3-certbot-nginx \
        > /dev/null

    # Enable and start services
    systemctl enable --now mariadb redis-server
}

install_packages_dnf() {
    echo "  → installing system dependencies"
    dnf install -y -q \
        curl git unzip openssl \
        mariadb-server redis \
        nginx certbot python3-certbot-nginx \
        > /dev/null

    # Enable and start services
    systemctl enable --now mariadb redis nginx
}

install_bun() {
    if command -v bun >/dev/null 2>&1; then
        local current_ver
        current_ver=$(bun --version 2>/dev/null || echo "0.0.0")
        echo "  → bun $current_ver already installed"
    else
        echo "  → installing bun"
        curl -fsSL https://bun.sh/install | bash > /dev/null 2>&1
        # Make bun available system-wide. Copy rather than symlink so it's
        # readable by other users (the install dir is in root's $HOME).
        if [ -f "$HOME/.bun/bin/bun" ]; then
            install -m 0755 "$HOME/.bun/bin/bun" /usr/local/bin/bun
            ln -sf /usr/local/bin/bun /usr/local/bin/bunx
        fi
    fi

    # Verify bun is available
    if ! command -v bun >/dev/null 2>&1; then
        export PATH="$HOME/.bun/bin:$PATH"
        if ! command -v bun >/dev/null 2>&1; then
            echo "✗ bun installation failed"
            exit 1
        fi
    fi
    echo "  ✓ bun $(bun --version)"
}

# ───── database setup ─────
setup_database() {
    local db_name="panel"
    local db_user="evodactyl"

    echo "  → creating database and user"

    mysql -u root <<SQL
CREATE DATABASE IF NOT EXISTS \`${db_name}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${db_user}'@'127.0.0.1' IDENTIFIED BY '${DB_PASSWORD}';
GRANT ALL PRIVILEGES ON \`${db_name}\`.* TO '${db_user}'@'127.0.0.1' WITH GRANT OPTION;
FLUSH PRIVILEGES;
SQL

    echo "  ✓ database '${db_name}' ready, user '${db_user}' granted"
}

# ───── systemd service ─────
create_systemd_service() {
    cat > /etc/systemd/system/evodactyl.service <<UNIT
[Unit]
Description=Evodactyl Panel
After=network.target mariadb.service redis.service
Requires=mariadb.service redis.service

[Service]
Type=simple
User=evodactyl
Group=evodactyl
WorkingDirectory=${INSTALL_DIR}
EnvironmentFile=${INSTALL_DIR}/.env
ExecStart=/usr/local/bin/bun run apps/api/src/index.ts
Restart=on-failure
RestartSec=5
StartLimitIntervalSec=60
StartLimitBurst=5

# Hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=${INSTALL_DIR}
PrivateTmp=true

[Install]
WantedBy=multi-user.target
UNIT

    systemctl daemon-reload
    echo "  ✓ systemd service created"
}

# ───── nginx config ─────
create_nginx_config() {
    local domain
    domain=$(echo "$PANEL_URL" | sed -E 's#^[a-z]+://##; s#/.*##; s#:.*##')

    cat > /etc/nginx/sites-available/evodactyl.conf <<NGINX
server {
    listen 80;
    server_name ${domain};

    location / {
        proxy_pass http://127.0.0.1:${PANEL_PORT};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_buffering off;
        proxy_request_buffering off;

        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
NGINX

    # Enable the site
    mkdir -p /etc/nginx/sites-enabled
    ln -sf /etc/nginx/sites-available/evodactyl.conf /etc/nginx/sites-enabled/evodactyl.conf

    # Remove default site if it exists
    rm -f /etc/nginx/sites-enabled/default

    # Test and reload nginx
    nginx -t 2>/dev/null && systemctl reload nginx
    echo "  ✓ nginx reverse proxy configured for ${domain}"
}

# ═════════════════════════════════════════════════════════════
#  Main installation flow
# ═════════════════════════════════════════════════════════════

detect_os

cat <<'BANNER'

  ╔══════════════════════════════════════════╗
  ║   Evodactyl Panel — native installer     ║
  ╚══════════════════════════════════════════╝

BANNER

echo "  Detected: $PRETTY_NAME ($PKG_MANAGER)"
echo

# ───── gather configuration ─────
echo "▶ Panel configuration"
ask PANEL_URL      "Panel URL (https://panel.example.com)"
ask PANEL_PORT     "Panel port" "8080"

# Detect timezone
if [ -r /etc/timezone ]; then
    DEFAULT_TZ=$(cat /etc/timezone)
elif command -v timedatectl >/dev/null 2>&1; then
    DEFAULT_TZ=$(timedatectl show -p Timezone --value 2>/dev/null || echo UTC)
else
    DEFAULT_TZ="UTC"
fi
ask PANEL_TIMEZONE "Timezone" "$DEFAULT_TZ"

echo
echo "▶ First administrator account"
ask        ADMIN_EMAIL     "Admin email"
ask        ADMIN_USERNAME  "Admin username"
ask        ADMIN_FIRST     "First name"
ask        ADMIN_LAST      "Last name"
ask_secret ADMIN_PASSWORD  "Admin password"

echo
echo "▶ Mail (optional)"
if confirm "Configure SMTP now?" n; then
    ask        MAIL_HOST            "SMTP host"
    ask        MAIL_PORT            "SMTP port" "587"
    ask        MAIL_USERNAME        "SMTP username"
    ask_secret MAIL_PASSWORD        "SMTP password"
    ask        MAIL_FROM_ADDRESS    "From address" "noreply@$(echo "$PANEL_URL" | sed -E 's#^[a-z]+://##; s#/.*##')"
else
    MAIL_HOST="smtp.example.com"
    MAIL_PORT="25"
    MAIL_USERNAME=""
    MAIL_PASSWORD=""
    MAIL_FROM_ADDRESS="noreply@example.com"
    echo "  → skipped (configure later in Admin → Settings → Mail)"
fi

echo
echo "▶ Generating secrets"
APP_KEY="base64:$(openssl rand -base64 32)"
DB_PASSWORD=$(openssl rand -hex 24)
echo "  ✓ APP_KEY, DB_PASSWORD"

# ───── install system packages ─────
echo
echo "▶ Installing system packages"
case "$PKG_MANAGER" in
    apt) install_packages_apt ;;
    dnf) install_packages_dnf ;;
esac
echo "  ✓ MariaDB, Redis, Nginx installed"

echo
echo "▶ Installing Bun runtime"
install_bun

# ───── create system user ─────
echo
echo "▶ Creating evodactyl system user"
if id evodactyl >/dev/null 2>&1; then
    echo "  → user already exists"
else
    useradd --system --home-dir "$INSTALL_DIR" --shell /usr/sbin/nologin evodactyl
    echo "  ✓ user created"
fi

# ───── clone source ─────
echo
echo "▶ Cloning Evodactyl source into ${INSTALL_DIR}"
mkdir -p "$(dirname "$INSTALL_DIR")"
if [ -d "$INSTALL_DIR/.git" ]; then
    echo "  ↻ existing checkout found, pulling latest"
    git -C "$INSTALL_DIR" fetch --depth 1 origin "$REPO_BRANCH"
    git -C "$INSTALL_DIR" checkout -B "$REPO_BRANCH" "origin/$REPO_BRANCH"
else
    git clone --depth 1 --branch "$REPO_BRANCH" "$REPO_URL" "$INSTALL_DIR"
fi
echo "  ✓ source at $INSTALL_DIR ($(git -C "$INSTALL_DIR" rev-parse --short HEAD))"

# ───── install dependencies ─────
echo
echo "▶ Installing application dependencies"
cd "$INSTALL_DIR"
bun install
echo "  ✓ dependencies installed"

# ───── build frontend ─────
echo
echo "▶ Building frontend"
bunx prisma generate --schema=packages/db/prisma/schema.prisma
bun run --filter=@evodactyl/web build
echo "  ✓ frontend built"

# Prune dev dependencies now that the build is done.
bun install --production

# ───── write .env ─────
echo
echo "▶ Writing configuration"
cat > "${INSTALL_DIR}/.env" <<ENV
# ── Core ──────────────────────────────────────────────
APP_KEY=${APP_KEY}
APP_URL=${PANEL_URL}
APP_ENV=production
APP_DEBUG=false
APP_TIMEZONE=${PANEL_TIMEZONE}
APP_LOCALE=en
APP_NAME=Evodactyl

PORT=${PANEL_PORT}

# ── Database ──────────────────────────────────────────
DATABASE_URL=mysql://evodactyl:${DB_PASSWORD}@127.0.0.1:3306/panel
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=panel
DB_USERNAME=evodactyl
DB_PASSWORD=${DB_PASSWORD}

# ── Redis ─────────────────────────────────────────────
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# ── Sessions ──────────────────────────────────────────
SESSION_DRIVER=redis
SESSION_COOKIE=evodactyl_session

# ── Hashids ───────────────────────────────────────────
HASHIDS_LENGTH=8

# ── Mail ──────────────────────────────────────────────
MAIL_HOST=${MAIL_HOST}
MAIL_PORT=${MAIL_PORT}
MAIL_USERNAME=${MAIL_USERNAME}
MAIL_PASSWORD=${MAIL_PASSWORD}
MAIL_ENCRYPTION=tls
MAIL_FROM_ADDRESS=${MAIL_FROM_ADDRESS}
MAIL_FROM_NAME="Evodactyl Panel"
ENV

chmod 640 "${INSTALL_DIR}/.env"

# Save secrets separately for backup reference
mkdir -p "${INSTALL_DIR}/.evodactyl"
cat > "${INSTALL_DIR}/.evodactyl/secrets" <<SECRETS
# Evodactyl install secrets — BACK THESE UP off-host.
# Losing APP_KEY makes every encrypted column in the database unrecoverable.
APP_KEY=${APP_KEY}
DB_PASSWORD=${DB_PASSWORD}
SECRETS
chmod 600 "${INSTALL_DIR}/.evodactyl/secrets"

echo "  ✓ .env written (mode 640)"
echo "  ✓ .evodactyl/secrets written (mode 600)"

# ───── set ownership ─────
chown -R evodactyl:evodactyl "$INSTALL_DIR"

# ───── setup database ─────
echo
echo "▶ Setting up database"
setup_database

echo
echo "▶ Running database migrations"
cd "$INSTALL_DIR"
sudo -u evodactyl bun run --filter=@evodactyl/db migrate
echo "  ✓ migrations complete"

echo
echo "▶ Seeding default nests and eggs"
sudo -u evodactyl bun run --filter=@evodactyl/api cli seed
echo "  ✓ seeded"

echo
echo "▶ Creating the first admin user"
sudo -u evodactyl bun run --filter=@evodactyl/api cli user:make \
    --email="$ADMIN_EMAIL" \
    --username="$ADMIN_USERNAME" \
    --name-first="$ADMIN_FIRST" \
    --name-last="$ADMIN_LAST" \
    --password="$ADMIN_PASSWORD" \
    --admin=true

# ───── systemd + nginx ─────
echo
echo "▶ Configuring systemd service"
create_systemd_service

echo
echo "▶ Configuring Nginx reverse proxy"
create_nginx_config

# ───── start the panel ─────
echo
echo "▶ Starting Evodactyl"
systemctl enable --now evodactyl

# Wait for health
echo -n "  waiting for health check"
tries=0
until curl -sf "http://127.0.0.1:${PANEL_PORT}/api/health" >/dev/null 2>&1; do
    tries=$((tries + 1))
    if [ "$tries" -gt 30 ]; then
        echo
        echo "  ✗ panel did not become healthy; check: journalctl -u evodactyl"
        exit 1
    fi
    printf '.'
    sleep 2
done
echo
echo "  ✓ healthy"

# ───── SSL prompt ─────
echo
DOMAIN=$(echo "$PANEL_URL" | sed -E 's#^[a-z]+://##; s#/.*##; s#:.*##')
if confirm "Set up Let's Encrypt SSL for ${DOMAIN}?" y; then
    certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email || {
        echo "  ⚠ certbot failed — you can retry later with: certbot --nginx -d ${DOMAIN}"
    }
fi

cat <<DONE

  ════════════════════════════════════════════
   ✓ Evodactyl is running natively

   Panel URL:    ${PANEL_URL}
   Admin login:  ${ADMIN_USERNAME}
   Install dir:  ${INSTALL_DIR}

   Services:
     Panel:    systemctl {start|stop|restart|status} evodactyl
     MariaDB:  systemctl {start|stop|restart|status} mariadb
     Redis:    systemctl {start|stop|restart|status} redis-server
     Nginx:    systemctl {start|stop|restart|status} nginx
     Logs:     journalctl -u evodactyl -f

   Secrets:    ${INSTALL_DIR}/.evodactyl/secrets  ← BACK THIS UP off-host

   To update later:
     cd ${INSTALL_DIR}
     sudo git pull
     sudo -u evodactyl bun install
     sudo -u evodactyl bun run --filter=@evodactyl/web build
     sudo -u evodactyl bun install --production
     sudo -u evodactyl bun run --filter=@evodactyl/db migrate
     sudo systemctl restart evodactyl

   CRITICAL: APP_KEY is the encryption key for every encrypted column in the
   database. Copy ${INSTALL_DIR}/.evodactyl/secrets somewhere safe NOW.
   Losing it is unrecoverable.
  ════════════════════════════════════════════

DONE
