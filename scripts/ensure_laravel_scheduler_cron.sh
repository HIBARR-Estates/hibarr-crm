#!/usr/bin/env bash
# Idempotently install `php artisan schedule:run` for the deploy symlink.
# Required for reminders:prepare (every 15m) and reminders:send-due (every minute).
set -euo pipefail

ARTISAN_PATH="${1:?Usage: $0 /absolute/path/to/artisan}"
PHP_BIN="${PHP_BIN:-/usr/bin/php}"

if [ ! -f "$ARTISAN_PATH" ] && [ ! -L "$ARTISAN_PATH" ]; then
    echo "ERROR: artisan not found at $ARTISAN_PATH"
    exit 1
fi

CRON_LINE="* * * * * ${PHP_BIN} ${ARTISAN_PATH} schedule:run >> /dev/null 2>&1"

EXISTING="$(crontab -l 2>/dev/null || true)"
FILTERED="$(printf '%s\n' "$EXISTING" | grep -Fv 'artisan schedule:run' || true)"

{
    printf '%s\n' "$FILTERED"
    printf '%s\n' "$CRON_LINE"
} | grep -v '^$' | crontab -

echo "Laravel scheduler cron installed:"
echo "  $CRON_LINE"
crontab -l | grep -F 'artisan schedule:run' || true
