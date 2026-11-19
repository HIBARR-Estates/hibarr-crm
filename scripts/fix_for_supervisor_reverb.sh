#!/usr/bin/env bash
# Run the self-hosted WebSocket server (Laravel Reverb) for realtime notifications under supervisor.
#
#   scripts/fix_for_supervisor_reverb.sh production|staging
#
# Called from the Jenkinsfile deploy (step 8) next to the queue-worker scripts. Safe to run on every
# deploy and before the server is provisioned:
#   - no REVERB_APP_KEY in the host's .env  -> removes the program if present and exits 0
#     (the CRM then keeps polling; nothing else changes)
#   - REVERB_APP_KEY present               -> (re)writes the program and restarts it
#
# Restarting drops every open socket. That is fine: browsers reconnect on their own and
# gap-fill what they missed from the database (GET api/notifications/since).
set -euo pipefail

ENV_NAME="${1:-production}"

case "$ENV_NAME" in
  production)
    LIVE_LINK="${LIVE_LINK:-/home/hibarr/hibarr-crm}"
    PROGRAM="hibarr_crm_reverb"
    ;;
  staging)
    LIVE_LINK="${LIVE_LINK:-/home/hibarr/hibarr-crm-staging}"
    PROGRAM="hibarr_crm_staging_reverb"
    ;;
  *)
    echo "Usage: $0 production|staging" >&2
    exit 2
    ;;
esac

CONF="/etc/supervisor/conf.d/${PROGRAM}.conf"
ENV_FILE="${LIVE_LINK}/.env"
# Where the process listens locally; nginx proxies /app and /apps to it (docs/realtime-notifications-ops.md).
SERVER_HOST="${REVERB_SERVER_HOST:-127.0.0.1}"
SERVER_PORT="${REVERB_SERVER_PORT:-8080}"

if [ ! -f "$ENV_FILE" ] || ! grep -qE '^REVERB_APP_KEY=.+' "$ENV_FILE"; then
  echo "Reverb is not provisioned (no REVERB_APP_KEY in ${ENV_FILE}); realtime notifications stay off."
  if [ -f "$CONF" ]; then
    sudo supervisorctl stop "${PROGRAM}" || true
    sudo rm -f "$CONF"
    sudo supervisorctl reread
    sudo supervisorctl update
    echo "Removed stale ${PROGRAM} program."
  fi
  exit 0
fi

mkdir -p /home/hibarr/shared
touch "/home/hibarr/shared/${PROGRAM}.log"

sudo tee "$CONF" > /dev/null << EOF
[program:${PROGRAM}]
process_name=%(program_name)s
command=/usr/bin/php ${LIVE_LINK}/artisan reverb:start --host=${SERVER_HOST} --port=${SERVER_PORT} --no-interaction
autostart=true
autorestart=true
user=hibarr
numprocs=1
redirect_stderr=true
stdout_logfile=/home/hibarr/shared/${PROGRAM}.log
stopwaitsecs=10
EOF

sudo supervisorctl reread
sudo supervisorctl update
# `update` starts a new program; a changed release needs an explicit restart so it runs the new code.
sudo supervisorctl restart "${PROGRAM}" || sudo supervisorctl start "${PROGRAM}"

sudo supervisorctl status "${PROGRAM}"
