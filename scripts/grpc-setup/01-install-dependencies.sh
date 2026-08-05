#!/usr/bin/env bash
set -euo pipefail

# ===========================================================================
# Step 1: Install gRPC infrastructure dependencies
#
# What this does:
#   - Installs protoc (Protocol Buffers compiler)
#   - Verifies PHP version and required extensions
#   - Creates the log directory for RoadRunner
#
# Run as root (or with sudo):
#   sudo bash scripts/grpc-setup/01-install-dependencies.sh
#
# After this, you can proceed to 02-setup-roadrunner-service.sh
# ===========================================================================

echo "============================================"
echo " Step 1: Install gRPC Dependencies"
echo "============================================"

# ──────────────────────────────────────────────
# 1. Install protoc (Protocol Buffers compiler)
#    This compiles .proto files into PHP classes.
#    Used by: make proto
#
#    We need protoc >= 3.15 for proto3 optional field support.
#    The apt package (protobuf-compiler) on Ubuntu 20/22 is too old,
#    so we download a known-good release from GitHub.
# ──────────────────────────────────────────────
PROTOC_MIN_MAJOR=3
PROTOC_MIN_MINOR=15
PROTOC_INSTALL_VERSION="28.3"  # Version to install if missing/outdated

protoc_needs_upgrade() {
    if ! command -v protoc &>/dev/null; then
        return 0  # not installed → needs install
    fi
    local ver
    ver=$(protoc --version | grep -oP '\d+\.\d+' | head -1)
    local major minor
    major=$(echo "$ver" | cut -d. -f1)
    minor=$(echo "$ver" | cut -d. -f2)
    if [ "$major" -lt "$PROTOC_MIN_MAJOR" ] || \
       ([ "$major" -eq "$PROTOC_MIN_MAJOR" ] && [ "$minor" -lt "$PROTOC_MIN_MINOR" ]); then
        return 0  # too old
    fi
    return 1  # good
}

echo ""
echo "[1/4] Protocol Buffers compiler (protoc)..."

if protoc_needs_upgrade; then
    CURRENT_VER=$(protoc --version 2>/dev/null || echo "not installed")
    echo "  Current: ${CURRENT_VER}"
    echo "  Required: >= ${PROTOC_MIN_MAJOR}.${PROTOC_MIN_MINOR} (for proto3 optional support)"
    echo "  Installing protoc v${PROTOC_INSTALL_VERSION} from GitHub..."

    ARCH=$(uname -m)
    case "$ARCH" in
        x86_64)  PROTOC_ARCH="linux-x86_64" ;;
        aarch64) PROTOC_ARCH="linux-aarch_64" ;;
        *)       echo "  ERROR: Unsupported architecture: ${ARCH}"; exit 1 ;;
    esac

    PROTOC_URL="https://github.com/protocolbuffers/protobuf/releases/download/v${PROTOC_INSTALL_VERSION}/protoc-${PROTOC_INSTALL_VERSION}-${PROTOC_ARCH}.zip"
    PROTOC_TMP=$(mktemp -d)

    echo "  Downloading ${PROTOC_URL}..."
    curl -fsSL -o "${PROTOC_TMP}/protoc.zip" "${PROTOC_URL}"
    unzip -qo "${PROTOC_TMP}/protoc.zip" -d "${PROTOC_TMP}/protoc"

    # Remove old apt version if present to avoid conflicts
    if dpkg -l protobuf-compiler &>/dev/null 2>&1; then
        echo "  Removing old apt protobuf-compiler package..."
        apt-get remove -y -qq protobuf-compiler 2>/dev/null || true
    fi

    # Install to /usr/local
    cp -f "${PROTOC_TMP}/protoc/bin/protoc" /usr/local/bin/protoc
    chmod +x /usr/local/bin/protoc
    # Include well-known types
    rm -rf /usr/local/include/google/protobuf
    cp -r "${PROTOC_TMP}/protoc/include/google" /usr/local/include/

    rm -rf "${PROTOC_TMP}"
    echo "  INSTALLED: $(protoc --version)"
else
    echo "  OK: $(protoc --version)"
fi

# ──────────────────────────────────────────────
# 2. Verify PHP version
#    RoadRunner + gRPC requires PHP 8.1+
# ──────────────────────────────────────────────
echo ""
echo "[2/4] PHP version check..."
if command -v php &>/dev/null; then
    PHP_VERSION=$(php -r "echo PHP_MAJOR_VERSION . '.' . PHP_MINOR_VERSION;")
    echo "  PHP version: ${PHP_VERSION}"

    PHP_MAJOR=$(php -r "echo PHP_MAJOR_VERSION;")
    PHP_MINOR=$(php -r "echo PHP_MINOR_VERSION;")
    if [ "$PHP_MAJOR" -lt 8 ] || ([ "$PHP_MAJOR" -eq 8 ] && [ "$PHP_MINOR" -lt 1 ]); then
        echo "  WARNING: PHP 8.1+ required. You have ${PHP_VERSION}."
        echo "  RoadRunner gRPC may not work correctly."
    else
        echo "  OK"
    fi
else
    echo "  ERROR: PHP not found. Install PHP 8.1+ first."
    exit 1
fi

# ──────────────────────────────────────────────
# 3. Verify required PHP extensions
#    - sockets: needed by RoadRunner relay
#    - mbstring: needed by protobuf serialization
#    - pdo_mysql: needed by Laravel DB (token validation)
# ──────────────────────────────────────────────
echo ""
echo "[3/4] PHP extensions check..."

REQUIRED_EXTENSIONS=("sockets" "mbstring" "pdo_mysql" "json" "tokenizer" "xml" "ctype")
MISSING=()

for ext in "${REQUIRED_EXTENSIONS[@]}"; do
    if php -m 2>/dev/null | grep -qi "^${ext}$"; then
        echo "  ${ext}: OK"
    else
        echo "  ${ext}: MISSING"
        MISSING+=("$ext")
    fi
done

if [ ${#MISSING[@]} -gt 0 ]; then
    echo ""
    echo "  Missing extensions: ${MISSING[*]}"
    echo "  To install (example for PHP ${PHP_VERSION}):"
    echo "    sudo apt-get install -y $(printf "php${PHP_VERSION}-%s " "${MISSING[@]}")"
    echo ""
    read -p "  Install missing extensions now? [y/N] " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        apt-get install -y $(printf "php${PHP_VERSION}-%s " "${MISSING[@]}")
        echo "  Extensions installed."
    else
        echo "  Skipped. Install them manually before running the gRPC server."
    fi
else
    echo "  All required extensions present."
fi

# ──────────────────────────────────────────────
# 4. Create RoadRunner log directory
#    The systemd service will write logs here.
# ──────────────────────────────────────────────
echo ""
echo "[4/4] Creating log directory..."

DEPLOY_USER="hibarr"
DEPLOY_GROUP="www-data"
LOG_DIR="/var/log/roadrunner-grpc"

if [ -d "${LOG_DIR}" ]; then
    echo "  ${LOG_DIR} already exists"
else
    mkdir -p "${LOG_DIR}"
    echo "  Created ${LOG_DIR}"
fi
chown "${DEPLOY_USER}:${DEPLOY_GROUP}" "${LOG_DIR}"
chmod 775 "${LOG_DIR}"
echo "  Permissions set: ${DEPLOY_USER}:${DEPLOY_GROUP} (775)"

# ──────────────────────────────────────────────
# Summary
# ──────────────────────────────────────────────
echo ""
echo "============================================"
echo " Dependencies Ready"
echo "============================================"
echo ""
echo " protoc:    $(protoc --version 2>/dev/null || echo 'NOT FOUND')"
echo " PHP:       $(php -v 2>/dev/null | head -1)"
echo " Log dir:   ${LOG_DIR}"
echo ""
echo " Next step:"
echo "   sudo bash scripts/grpc-setup/02-setup-roadrunner-service.sh"
echo ""
