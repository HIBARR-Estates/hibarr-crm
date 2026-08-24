#!/usr/bin/env bash
# Point this release's storage/ at ~/shared/storage so file cache + sessions
# survive atomic deploys (same pattern as shared/.env and user-uploads).
set -euo pipefail

SHARED="${1:?shared storage path}"
BUILD_PATH="${2:?release path}"
LIVE_LINK="${3:-}"

mkdir -p \
  "$SHARED/framework/cache/data" \
  "$SHARED/framework/sessions" \
  "$SHARED/framework/views" \
  "$SHARED/logs" \
  "$SHARED/app/public"

# One-time / recovery: if live still has a real storage dir, merge it in.
if [ -n "$LIVE_LINK" ] && [ -e "$LIVE_LINK/storage" ] && [ ! -L "$LIVE_LINK/storage" ]; then
  echo "Migrating existing live storage into ${SHARED}"
  rsync -a "$LIVE_LINK/storage/" "$SHARED/"
fi

# Preserve anything written into this release's storage before the swap
# (git clone / ensure-storage / build steps).
if [ -d "$BUILD_PATH/storage" ] && [ ! -L "$BUILD_PATH/storage" ]; then
  echo "Merging release storage into ${SHARED}"
  rsync -a "$BUILD_PATH/storage/" "$SHARED/"
  rm -rf "$BUILD_PATH/storage"
elif [ -L "$BUILD_PATH/storage" ]; then
  rm -f "$BUILD_PATH/storage"
elif [ -e "$BUILD_PATH/storage" ]; then
  rm -rf "$BUILD_PATH/storage"
fi

ln -sfn "$SHARED" "$BUILD_PATH/storage"
# Cosmetic: symlink ownership (target perms are handled separately).
chown -h hibarr:www-data "$BUILD_PATH/storage" 2>/dev/null || true

echo "Linked ${BUILD_PATH}/storage -> ${SHARED}"
ls -ld "$BUILD_PATH/storage"
