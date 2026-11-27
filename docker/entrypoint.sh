#!/usr/bin/env bash
set -euo pipefail

cd /var/www/html

mkdir -p \
  storage/framework/cache/data \
  storage/framework/sessions \
  storage/framework/views \
  storage/logs \
  storage/app/public \
  bootstrap/cache \
  public/user-uploads

upsert_env() {
  local key="$1"
  local value="$2"
  local tmp
  tmp="$(mktemp)"
  grep -vE "^${key}=" .env > "$tmp" || true
  printf '%s=%s\n' "$key" "$value" >> "$tmp"
  mv "$tmp" .env
}

fetch_infisical_env() {
  if [ -z "${INFISICAL_TOKEN:-}" ] || [ -z "${INFISICAL_API_URL:-}" ] || [ -z "${INFISICAL_PROJECT_ID:-}" ]; then
    echo "ERROR: INFISICAL_TOKEN, INFISICAL_API_URL, and INFISICAL_PROJECT_ID must be set."
    echo "Put them in the host .env next to docker-compose.yml; the container fetches secrets at startup."
    exit 1
  fi

  local env_slug="${INFISICAL_ENV:-dev}"
  local env_file=".env"

  echo "Fetching secrets from Infisical (env=${env_slug}, project=${INFISICAL_PROJECT_ID})..."

  export INFISICAL_TOKEN
  export INFISICAL_API_URL
  export INFISICAL_DOMAIN="${INFISICAL_API_URL}"
  export INFISICAL_DISABLE_UPDATE_CHECK=true

  infisical export \
    --token="$INFISICAL_TOKEN" \
    --projectId="$INFISICAL_PROJECT_ID" \
    --env="$env_slug" \
    --domain="$INFISICAL_API_URL" \
    --format=dotenv \
    --output-file="$env_file"

  local nonempty
  nonempty="$(grep -vE '^[[:space:]]*(#|$)' "$env_file" 2>/dev/null | wc -l | tr -d ' ')"
  if [ ! -s "$env_file" ] || [ "${nonempty:-0}" -eq 0 ]; then
    echo "ERROR: Infisical export for env='${env_slug}' returned an empty .env."
    echo "Check INFISICAL_TOKEN, INFISICAL_API_URL, INFISICAL_PROJECT_ID, and that the identity can read this env."
    rm -f "$env_file"
    exit 1
  fi

  echo "Loaded ${nonempty} secret line(s) from Infisical."

  # Docker-only values must win over whatever Infisical stored.
  [ -n "${GRPC_ENABLED:-}" ] && upsert_env GRPC_ENABLED "$GRPC_ENABLED"
  [ -n "${APP_BUNDLER:-}" ] && upsert_env APP_BUNDLER "$APP_BUNDLER"
  [ -n "${REDIRECT_HTTPS:-}" ] && upsert_env REDIRECT_HTTPS "$REDIRECT_HTTPS"
  [ -n "${APP_URL:-}" ] && upsert_env APP_URL "$APP_URL"
  [ -n "${TRUSTED_PROXIES:-}" ] && upsert_env TRUSTED_PROXIES "$TRUSTED_PROXIES"
  # Headless browser paths (pdf image flavor); config/pdf_browser.php reads them.
  [ -n "${BROWSERSHOT_NODE_BINARY:-}" ] && upsert_env BROWSERSHOT_NODE_BINARY "$BROWSERSHOT_NODE_BINARY"
  [ -n "${BROWSERSHOT_NODE_MODULES_PATH:-}" ] && upsert_env BROWSERSHOT_NODE_MODULES_PATH "$BROWSERSHOT_NODE_MODULES_PATH"
  [ -n "${BROWSERSHOT_CHROME_PATH:-}" ] && upsert_env BROWSERSHOT_CHROME_PATH "$BROWSERSHOT_CHROME_PATH"

  chmod 600 "$env_file"

  set -a
  # shellcheck disable=SC1091
  source "$env_file"
  set +a
}

wait_for_db() {
  local host="${DB_HOST:-}"
  local port="${DB_PORT:-3306}"
  local user="${DB_USERNAME:-}"
  local pass="${DB_PASSWORD:-}"
  local tries="${DB_WAIT_TRIES:-60}"

  if [ -z "$host" ] || [ -z "$user" ]; then
    echo "ERROR: DB_HOST and DB_USERNAME must be set after Infisical export."
    exit 1
  fi

  echo "Waiting for MySQL at ${host}:${port}..."
  for i in $(seq 1 "$tries"); do
    if mysqladmin ping -h "$host" -P "$port" -u "$user" ${pass:+-p"$pass"} --silent 2>/dev/null; then
      echo "MySQL is up."
      return 0
    fi
    sleep 2
  done
  echo "WARNING: MySQL did not become ready in time; continuing anyway."
}

ensure_app_key() {
  local key_file="storage/app/.docker_app_key"

  if [ -n "${APP_KEY:-}" ] && [[ "${APP_KEY}" == base64:* ]]; then
    return 0
  fi

  if [ -f "$key_file" ]; then
    export APP_KEY="$(cat "$key_file")"
    upsert_env APP_KEY "$APP_KEY"
    echo "Loaded APP_KEY from ${key_file}"
    return 0
  fi

  # Workers wait for the web container to persist the key first.
  if [ "${CONTAINER_ROLE:-app}" != "app" ]; then
    echo "Waiting for APP_KEY at ${key_file}..."
    for _ in $(seq 1 60); do
      if [ -f "$key_file" ]; then
        export APP_KEY="$(cat "$key_file")"
        upsert_env APP_KEY "$APP_KEY"
        echo "Loaded APP_KEY from ${key_file}"
        return 0
      fi
      sleep 2
    done
  fi

  export APP_KEY="$(php -r 'echo "base64:".base64_encode(random_bytes(32));')"
  printf '%s' "$APP_KEY" > "$key_file"
  upsert_env APP_KEY "$APP_KEY"
  echo "Generated and persisted APP_KEY to ${key_file}"
}

fetch_infisical_env

role="${CONTAINER_ROLE:-app}"

if [ "$role" = "app" ] || [ "$role" = "queue" ] || [ "$role" = "scheduler" ] || [ "$role" = "grpc" ]; then
  wait_for_db
  ensure_app_key
fi

# Same steps the Jenkins deploy runs (Makefile: finalize-deploy). Only the web
# role does them; other roles start from the same image and database.
if [ "$role" = "app" ]; then
  if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
    # No `|| true`: a failed migration must stop the container, not serve a half-migrated schema.
    php artisan migrate --force --no-interaction
  fi

  # public/storage is gitignored, so every new container needs the link.
  php artisan storage:link --force --no-interaction 2>/dev/null || true

  if [ "${RUN_DEPLOY_TASKS:-true}" = "true" ]; then
    # The storage volume outlives the image, so drop caches written by the previous release.
    php artisan translations:clear --no-interaction || echo "WARNING: translations:clear failed"
    php artisan cache:clear --no-interaction || echo "WARNING: cache:clear failed"
    php artisan config:clear --no-interaction || true
    php artisan route:clear --no-interaction || true
    # Idempotent: company EntityReminderDefault + ReminderEmailTemplate rows.
    php artisan reminders:seed-entity-defaults --no-interaction || echo "WARNING: reminders:seed-entity-defaults failed (are migrations applied?)"
  fi
fi

# Jenkins runs these after switching releases. Every role reads the same .env,
# so each one caches its own copy. Set OPTIMIZE_ON_BOOT=false to skip.
if [ "$role" != "grpc" ] && [ "${OPTIMIZE_ON_BOOT:-true}" = "true" ]; then
  php artisan config:cache --no-interaction || echo "WARNING: config:cache failed"
  php artisan route:cache --no-interaction || echo "WARNING: route:cache failed"
  php artisan view:cache --no-interaction || echo "WARNING: view:cache failed"
fi

chown -R www-data:www-data storage bootstrap/cache public/user-uploads 2>/dev/null || true

# Run workers as www-data. As root they would create files in the shared
# storage volume (laravel-<date>.log, cache) that PHP-FPM cannot write to.
# setpriv execs the command itself (runuser may stay as a parent), so the worker
# is PID 1 and gets SIGTERM directly: queue:work then finishes its current job.
as_www() {
  exec setpriv --reuid=www-data --regid=www-data --init-groups -- "$@"
}

case "$role" in
  queue)
    echo "Starting queue worker (${QUEUE_NAMES:-default})..."
    as_www php artisan queue:work "${QUEUE_CONNECTION:-database}" \
      --queue="${QUEUE_NAMES:-default,communication_activities,resolvers,PropertyImport,LeadImport,DealImport,reminders-prepare,reminders-send,ol_webhooks}" \
      --sleep="${QUEUE_SLEEP:-3}" \
      --tries="${QUEUE_TRIES:-3}" \
      --timeout="${QUEUE_TIMEOUT:-300}"
    ;;
  scheduler)
    echo "Starting scheduler..."
    # schedule:work ticks on the minute and starts each run in the background.
    # A sleep loop drifts by the run time and skips minutes, which drops dailyAt
    # tasks, and blocks on the long queue:work that Kernel.php schedules.
    as_www php artisan schedule:work --no-interaction
    ;;
  grpc)
    echo "Starting RoadRunner gRPC server..."
    [ -x ./rr ] || { echo "ERROR: ./rr not found. Build the image with --target grpc."; exit 1; }
    # .rr.staging.yaml (shared with the Jenkins hosts) listens on 9001; override it here.
    as_www ./rr serve -c .rr.staging.yaml -o "grpc.listen=tcp://0.0.0.0:${GRPC_PORT:-9010}"
    ;;
  app|*)
    exec "$@"
    ;;
esac
