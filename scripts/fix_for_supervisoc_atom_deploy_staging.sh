#!/usr/bin/env bash
# Ensure staging queue workers listen to all app queues (incl. entity reminders).
set -euo pipefail

LIVE_LINK="${LIVE_LINK:-/home/hibarr/hibarr-crm-staging}"
QUEUES="default,communication_activities,resolvers,PropertyImport,LeadImport,DealImport,reminders-prepare,reminders-send"

# 1. Verify the symlink exists and where it points
ls -la "$LIVE_LINK"

# 2. Update supervisor config
sudo tee /etc/supervisor/conf.d/hibarr_crm_staging.conf > /dev/null << EOF
[program:hibarr_crm_staging]
process_name=%(program_name)s_%(process_num)02d
command=/usr/bin/php ${LIVE_LINK}/artisan queue:work database --queue=${QUEUES} --sleep=3 --tries=3 --timeout=300
autostart=true
autorestart=true
user=hibarr
numprocs=1
redirect_stderr=true
stdout_logfile=/home/hibarr/shared/worker.log
stopwaitsecs=3600
EOF

# 3. Create the shared log file
mkdir -p /home/hibarr/shared
touch /home/hibarr/shared/worker.log

# 4. Reload and start
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl restart hibarr_crm_staging:*

# 5. Verify
sudo supervisorctl status
