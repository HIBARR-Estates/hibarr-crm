#!/usr/bin/env bash
# Make file cache/sessions writable by both the deploy user (cron/artisan)
# and PHP-FPM (www-data or hibarr). setgid + 664 + default ACLs so new files
# stay group-writable even when FPM umask is 0022.
set -euo pipefail

BUILD_PATH="${1:?release path}"
OWNER="${2:-hibarr}"
GROUP="www-data"

STORAGE="$(readlink -f "$BUILD_PATH/storage")"
BOOTSTRAP="$BUILD_PATH/bootstrap/cache"

if [ ! -d "$STORAGE" ]; then
  echo "ERROR: storage path missing: $STORAGE (from $BUILD_PATH/storage)"
  exit 1
fi

mkdir -p \
  "$BOOTSTRAP" \
  "$STORAGE/framework/cache/data" \
  "$STORAGE/framework/sessions" \
  "$STORAGE/framework/views" \
  "$STORAGE/logs" \
  "$STORAGE/app/public"

sudo chown -R "${OWNER}:${GROUP}" "$STORAGE" "$BOOTSTRAP" || true
if [ -L "$BUILD_PATH/storage" ]; then
  sudo chown -h "${OWNER}:${GROUP}" "$BUILD_PATH/storage" || true
fi

find "$STORAGE" "$BOOTSTRAP" -type d -exec chmod 2775 {} \;
find "$STORAGE" "$BOOTSTRAP" -type f -exec chmod 664 {} \;

if command -v setfacl >/dev/null 2>&1; then
  setfacl -R -m "u:${OWNER}:rwX" -m "u:www-data:rwX" -m "g:${GROUP}:rwX" "$STORAGE" "$BOOTSTRAP" || true
  setfacl -R -d -m "u:${OWNER}:rwX" -m "u:www-data:rwX" -m "g:${GROUP}:rwX" "$STORAGE" "$BOOTSTRAP" || true
fi

echo "Storage permissions applied on ${STORAGE} (+ bootstrap/cache)"
ls -ld "$BUILD_PATH/storage" "$STORAGE" "$BOOTSTRAP"
