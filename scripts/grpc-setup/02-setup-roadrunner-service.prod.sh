#!/usr/bin/env bash
set -euo pipefail

# ===========================================================================
# Step 2: Setup RoadRunner as a systemd service
#
# What this does:
#   - Verifies the RoadRunner binary exists (created by `make rr-install`)
#   - Installs the systemd service unit for roadrunner-grpc
#   - Adds sudoers rules so the deploy user can restart the service
#   - Starts the service and runs a health check
#
# Prerequisites:
#   - 01-install-dependencies.sh already ran
#   - The project is deployed at /home/hibarr/hibarr-crm
#   - `make rr-install` was run (the `rr` binary exists)
#
# Run as root (or with sudo):
#   sudo bash scripts/grpc-setup/02-setup-roadrunner-service.sh
# ===========================================================================

DEPLOY_USER="hibarr"
DEPLOY_GROUP="www-data"
STAGING_PATH="/home/${DEPLOY_USER}/hibarr-crm"
SERVICE_NAME="roadrunner-grpc"

echo "============================================"
echo " Step 2: Setup RoadRunner systemd Service"
echo " Path: ${STAGING_PATH}"
echo "============================================"

# ──────────────────────────────────────────────
# 1. Verify the RoadRunner binary exists
# ──────────────────────────────────────────────
echo ""
echo "[1/5] Checking RoadRunner binary..."
RR_BIN="${STAGING_PATH}/rr"

if [ -x "${RR_BIN}" ]; then
    echo "  Found: ${RR_BIN}"
    echo "  Version: $("${RR_BIN}" --version 2>/dev/null || echo 'unknown')"
else
    echo "  Binary not found or not executable at ${RR_BIN}"
    echo ""
    echo "  To fix, run these as the deploy user:"
    echo "    cd ${STAGING_PATH}"
    echo "    make rr-install"
    echo "    chmod +x ./rr"
    echo ""
    echo "  Then re-run this script."
    exit 1
fi

# ──────────────────────────────────────────────
# 2. Verify the staging config exists
# ──────────────────────────────────────────────
echo ""
echo "[2/5] Checking .rr.staging.yaml..."
RR_CONFIG="${STAGING_PATH}/.rr.staging.yaml"

if [ -f "${RR_CONFIG}" ]; then
    echo "  Found: ${RR_CONFIG}"

    # Show what ports will be used
    echo ""
    echo "  Ports configured:"
    grep -E "listen:|address:" "${RR_CONFIG}" | sed 's/^/    /'
else
    echo "  ERROR: ${RR_CONFIG} not found."
    echo "  Make sure the staging branch is deployed."
    exit 1
fi

# ──────────────────────────────────────────────
# 3. Install the systemd service unit
# ──────────────────────────────────────────────
echo ""
echo "[3/5] Installing systemd service..."
UNIT_FILE="${STAGING_PATH}/scripts/roadrunner-grpc.prod.service"

if [ ! -f "${UNIT_FILE}" ]; then
    echo "  ERROR: ${UNIT_FILE} not found."
    echo "  Make sure the staging branch is deployed."
    exit 1
fi

# Copy and install
cp "${UNIT_FILE}" /etc/systemd/system/${SERVICE_NAME}.service
systemctl daemon-reload
systemctl enable ${SERVICE_NAME}
echo "  Installed: /etc/systemd/system/${SERVICE_NAME}.service"
echo "  Enabled:   systemctl enable ${SERVICE_NAME}"

# ──────────────────────────────────────────────
# 4. Setup sudoers for deploy user
#    So Jenkins can restart the service without password
# ──────────────────────────────────────────────
echo ""
echo "[4/5] Configuring sudoers for deploy user..."
SUDOERS_FILE="/etc/sudoers.d/${DEPLOY_USER}-grpc"

cat > "${SUDOERS_FILE}" << 'EOF'
# Allow deploy user to manage gRPC server and reload web services
hibarr ALL=(ALL) NOPASSWD: /bin/systemctl restart roadrunner-grpc
hibarr ALL=(ALL) NOPASSWD: /bin/systemctl stop roadrunner-grpc
hibarr ALL=(ALL) NOPASSWD: /bin/systemctl start roadrunner-grpc
hibarr ALL=(ALL) NOPASSWD: /bin/systemctl status roadrunner-grpc
hibarr ALL=(ALL) NOPASSWD: /bin/systemctl reload nginx
hibarr ALL=(ALL) NOPASSWD: /bin/systemctl reload php8.3-fpm
EOF
chmod 440 "${SUDOERS_FILE}"

# Validate sudoers file
if visudo -cf "${SUDOERS_FILE}" &>/dev/null; then
    echo "  Sudoers file validated OK: ${SUDOERS_FILE}"
else
    echo "  WARNING: Sudoers file has syntax errors!"
    rm -f "${SUDOERS_FILE}"
    echo "  Removed invalid file. Check and try again."
    exit 1
fi

# ──────────────────────────────────────────────
# 5. Start the service and verify
# ──────────────────────────────────────────────
echo ""
echo "[5/5] Starting ${SERVICE_NAME}..."

# Stop first if already running
systemctl stop ${SERVICE_NAME} 2>/dev/null || true
sleep 1

# Start
systemctl start ${SERVICE_NAME}

echo "  Waiting for workers to allocate (10 seconds)..."
sleep 10

# Check status
if systemctl is-active --quiet ${SERVICE_NAME}; then
    echo ""
    echo "  SERVICE STATUS: RUNNING"
    echo ""

    # Show the process
    systemctl status ${SERVICE_NAME} --no-pager -l 2>/dev/null | head -15 | sed 's/^/  /'

    echo ""
    # Health check
    echo "  Running health check on http://127.0.0.1:2114/health ..."
    if curl -sf http://127.0.0.1:2114/health 2>/dev/null; then
        echo ""
        echo "  HEALTH CHECK: PASSED"
    else
        echo "  HEALTH CHECK: No response yet (may need more time)"
        echo "  Try manually: curl http://127.0.0.1:2114/health"
    fi
else
    echo ""
    echo "  SERVICE STATUS: FAILED TO START"
    echo ""
    echo "  Recent logs:"
    journalctl -u ${SERVICE_NAME} -n 30 --no-pager 2>/dev/null | sed 's/^/    /'
    echo ""
    echo "  Also check: cat /var/log/roadrunner-grpc/error.log"
    exit 1
fi

# ──────────────────────────────────────────────
# Summary
# ──────────────────────────────────────────────
echo ""
echo "============================================"
echo " RoadRunner Service Ready"
echo "============================================"
echo ""
echo " Service:     ${SERVICE_NAME}"
echo " Config:      ${RR_CONFIG}"
echo " gRPC port:   9001  (accessible via server IP)"
echo " Health port: 2114"
echo " RPC port:    6001  (internal only)"
echo ""
echo " Useful commands:"
echo "   sudo systemctl status ${SERVICE_NAME}"
echo "   sudo systemctl restart ${SERVICE_NAME}"
echo "   sudo systemctl stop ${SERVICE_NAME}"
echo "   journalctl -u ${SERVICE_NAME} -f          # live logs"
echo "   cat /var/log/roadrunner-grpc/error.log     # error log"
echo ""
echo " Next step — test from your machine:"
echo "   03-test-with-ip.sh has test commands"
echo "   Or manually: grpcurl -plaintext SERVER_IP:9001 list"
echo ""
