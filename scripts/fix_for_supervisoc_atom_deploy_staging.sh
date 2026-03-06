# 1. Verify the symlink exists and where it points
ls -la /home/hibarr/hibarr-crm-staging

# 2. Update supervisor config
sudo tee /etc/supervisor/conf.d/hibarr_crm_staging.conf > /dev/null << 'EOF'
[program:hibarr_crm_staging]
process_name=%(program_name)s_%(process_num)02d
command=/usr/bin/php /home/hibarr/hibarr-crm-staging/artisan queue:work database --queue=default,communication_activities,resolvers,PropertyImport --sleep=3 --tries=3 --timeout=300
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