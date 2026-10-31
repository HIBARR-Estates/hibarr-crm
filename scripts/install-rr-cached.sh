#!/usr/bin/env bash
# Install the RoadRunner binary into ./rr, reusing a copy cached across releases.
#
# Every release is built in a fresh directory, so `make rr-install` re-downloaded
# the binary on every deploy. The binary only changes when the RoadRunner
# packages do, which means when composer.lock does, so the lock hash is the key.
#
# Usage (from the release directory, after `composer install`):
#   bash scripts/install-rr-cached.sh /home/<user>/shared/cache/rr
set -euo pipefail

cache_dir="${1:?usage: install-rr-cached.sh <cache-dir>}"
mkdir -p "$cache_dir"

key="$(sha1sum composer.lock | cut -c1-16)"
cached="$cache_dir/rr-$key"

if [ -x "$cached" ]; then
    cp "$cached" ./rr
    echo "RoadRunner: reused cached binary ($key)"
else
    make rr-install
    cp ./rr "$cached"
    echo "RoadRunner: downloaded and cached ($key)"
fi
chmod +x ./rr

# Keep the three most recent binaries; older lock hashes are never needed again.
# shellcheck disable=SC2012
ls -1t "$cache_dir"/rr-* 2>/dev/null | tail -n +4 | xargs -r rm -f
