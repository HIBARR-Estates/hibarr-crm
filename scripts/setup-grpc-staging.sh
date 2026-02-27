#!/usr/bin/env bash
set -euo pipefail

# ===========================================================================
# HiBarr CRM — One-time gRPC staging server setup
#
# Run this ONCE on the staging server as root (or with sudo).
# After this, Jenkins handles all subsequent deploys automatically.
#
# Usage:
#   sudo bash scripts/setup-grpc-staging.sh grpc.staging.YOURDOMAIN.com
#
# Prerequisites:
#   - Ubuntu 20.04+ / Debian 11+
#   - nginx installed
#   - certbot + python3-certbot-nginx installed
#   - The project already deployed at /home/hibarr/hibarr-crm-staging
#   - DNS A record for the domain pointing to this server's IP
# ===========================================================================

DOMAIN="${1:?Usage: $0 <grpc-domain>  (e.g. grpc.staging.example.com)}"
DEPLOY_USER="hibarr"
DEPLOY_GROUP="www-data"
STAGING_PATH="/home/${DEPLOY_USER}/hibarr-crm-staging"
SERVICE_NAME="roadrunner-grpc"

echo "============================================"
echo " HiBarr gRPC Staging Setup"
echo " Domain: ${DOMAIN}"
echo " Path:   ${STAGING_PATH}"
echo "============================================"

# ──────────────────────────────────────────────
# 1. Install protoc (Protocol Buffers compiler)
# ──────────────────────────────────────────────
echo ""
echo "[1/7] Installing protobuf compiler..."
if ! command -v protoc &>/dev/null; then
    apt-get update -qq
    apt-get install -y -qq protobuf-compiler
    echo "  protoc installed: $(protoc --version)"
else
    echo "  protoc already installed: $(protoc --version)"
fi

# ──────────────────────────────────────────────
# 2. Create log directory
# ──────────────────────────────────────────────
echo ""
echo "[2/7] Creating log directory..."
mkdir -p /var/log/roadrunner-grpc
chown "${DEPLOY_USER}:${DEPLOY_GROUP}" /var/log/roadrunner-grpc
chmod 775 /var/log/roadrunner-grpc
echo "  /var/log/roadrunner-grpc created"

# ──────────────────────────────────────────────
# 3. Install systemd service unit
# ──────────────────────────────────────────────
echo ""
echo "[3/7] Installing systemd service..."
UNIT_FILE="${STAGING_PATH}/scripts/roadrunner-grpc.service"
if [ ! -f "${UNIT_FILE}" ]; then
    echo "  ERROR: ${UNIT_FILE} not found. Deploy the project first."
    exit 1
fi
cp "${UNIT_FILE}" /etc/systemd/system/${SERVICE_NAME}.service
systemctl daemon-reload
systemctl enable ${SERVICE_NAME}
echo "  ${SERVICE_NAME}.service installed and enabled"

# ──────────────────────────────────────────────
# 4. Install nginx gRPC reverse proxy config
# ──────────────────────────────────────────────
echo ""
echo "[4/7] Installing nginx config..."
NGINX_CONF="${STAGING_PATH}/scripts/nginx-grpc-staging.conf"
if [ ! -f "${NGINX_CONF}" ]; then
    echo "  ERROR: ${NGINX_CONF} not found. Deploy the project first."
    exit 1
fi

# Replace placeholder domain with actual domain
sed "s/grpc\.staging\.YOURDOMAIN\.com/${DOMAIN}/g" "${NGINX_CONF}" \
    > /etc/nginx/sites-available/grpc-staging

ln -sf /etc/nginx/sites-available/grpc-staging /etc/nginx/sites-enabled/

# Temporarily remove SSL lines for initial config test (certbot will add them)
# Test nginx config
if nginx -t 2>/dev/null; then
    echo "  nginx config test passed"
else
    echo "  WARNING: nginx config test failed. Check /etc/nginx/sites-available/grpc-staging"
    echo "  This is expected if the TLS cert doesn't exist yet (certbot will fix this)."
fi

# ──────────────────────────────────────────────
# 5. Obtain TLS certificate via Let's Encrypt
# ──────────────────────────────────────────────
echo ""
echo "[5/7] Obtaining TLS certificate..."
if [ -d "/etc/letsencrypt/live/${DOMAIN}" ]; then
    echo "  Certificate already exists for ${DOMAIN}"
else
    echo "  Running certbot for ${DOMAIN}..."
    echo "  NOTE: DNS A record must point to this server's IP."
    certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos --redirect \
        --email "admin@${DOMAIN%%.*}.com" || {
        echo "  WARNING: certbot failed. You may need to run it manually:"
        echo "    sudo certbot --nginx -d ${DOMAIN}"
    }
fi

# ──────────────────────────────────────────────
# 6. Configure firewall
# ──────────────────────────────────────────────
echo ""
echo "[6/7] Configuring firewall..."
if command -v ufw &>/dev/null; then
    echo "  UFW detected. Configuring rules..."
    ufw allow 443/tcp comment "gRPC over TLS"  2>/dev/null || true
    ufw allow 80/tcp comment "HTTP (certbot renewal)" 2>/dev/null || true
    # Ensure gRPC internal ports are NOT open
    ufw deny 9001/tcp comment "Block direct gRPC (use nginx)" 2>/dev/null || true
    ufw deny 2114/tcp comment "Block health check externally" 2>/dev/null || true
    ufw deny 6001/tcp comment "Block RPC port externally" 2>/dev/null || true
    echo "  UFW rules applied"
    ufw status numbered 2>/dev/null || true
elif command -v iptables &>/dev/null; then
    echo "  UFW not found. Using iptables..."
    # Allow HTTPS
    iptables -A INPUT -p tcp --dport 443 -j ACCEPT 2>/dev/null || true
    # Block direct access to RoadRunner ports from external
    iptables -A INPUT -p tcp --dport 9001 -j DROP 2>/dev/null || true
    iptables -A INPUT -p tcp --dport 2114 -j DROP 2>/dev/null || true
    iptables -A INPUT -p tcp --dport 6001 -j DROP 2>/dev/null || true
    echo "  iptables rules applied"
else
    echo "  WARNING: No firewall tool detected (ufw/iptables)."
    echo "  Please manually ensure ports 9001, 2114, 6001 are NOT publicly accessible."
    echo "  Port 443 should be open for gRPC + TLS."
fi

# ──────────────────────────────────────────────
# 7. Setup sudoers for deploy user
# ──────────────────────────────────────────────
echo ""
echo "[7/7] Configuring sudoers for deploy user..."
SUDOERS_FILE="/etc/sudoers.d/${DEPLOY_USER}-grpc"
cat > "${SUDOERS_FILE}" << 'EOF'
# Allow deploy user to restart gRPC server and reload nginx without password
hibarr ALL=(ALL) NOPASSWD: /bin/systemctl restart roadrunner-grpc
hibarr ALL=(ALL) NOPASSWD: /bin/systemctl reload nginx
hibarr ALL=(ALL) NOPASSWD: /bin/systemctl reload php8.3-fpm
hibarr ALL=(ALL) NOPASSWD: /usr/bin/chown -R hibarr\:www-data *
hibarr ALL=(ALL) NOPASSWD: /usr/bin/chmod -R 775 *
EOF
chmod 440 "${SUDOERS_FILE}"
echo "  Sudoers rules written to ${SUDOERS_FILE}"

# ──────────────────────────────────────────────
# Start the service
# ──────────────────────────────────────────────
echo ""
echo "============================================"
echo " Starting gRPC server..."
echo "============================================"
systemctl start ${SERVICE_NAME} || true
sleep 2

if systemctl is-active --quiet ${SERVICE_NAME}; then
    echo ""
    echo "  gRPC server is RUNNING"
    
    # Quick health check
    if curl -sf http://127.0.0.1:2114/health > /dev/null 2>&1; then
        echo "  Health check: PASSED"
    else
        echo "  Health check: PENDING (may take a few seconds for workers to allocate)"
    fi
else
    echo ""
    echo "  WARNING: Service failed to start. Check logs:"
    echo "    journalctl -u ${SERVICE_NAME} -n 50 --no-pager"
    echo "    cat /var/log/roadrunner-grpc/error.log"
fi

echo ""
echo "============================================"
echo " Setup Complete!"
echo "============================================"
echo ""
echo " gRPC endpoint:  ${DOMAIN}:443"
echo " Health check:   curl http://127.0.0.1:2114/health  (local only)"
echo " Service logs:   journalctl -u ${SERVICE_NAME} -f"
echo " Nginx logs:     /var/log/nginx/grpc-staging-*.log"
echo " RR error log:   /var/log/roadrunner-grpc/error.log"
echo ""
echo " Client connection:"
echo "   grpcurl -d '{}' ${DOMAIN}:443 hibarr.crm.deal.DealService/List"
echo ""
echo " Test auth rejection (should return UNAUTHENTICATED):"
echo "   grpcurl ${DOMAIN}:443 hibarr.crm.deal.DealService/List"
echo ""
