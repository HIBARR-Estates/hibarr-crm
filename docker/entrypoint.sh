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

# A machine identity's access token is short-lived, so one injected as
# INFISICAL_TOKEN stops working after its TTL and a container restarted later
# (crash, host reboot, redeploy) could no longer boot. When a client id/secret
# is provided, log in at every start instead, as the Jenkins deploy does.
mint_infisical_token() {
  if [ -n "${INFISICAL_CLIENT_ID:-}" ] && [ -n "${INFISICAL_CLIENT_SECRET:-}" ]; then
    if [ -z "${INFISICAL_API_URL:-}" ]; then
      echo "ERROR: INFISICAL_API_URL must be set to log in with INFISICAL_CLIENT_ID/INFISICAL_CLIENT_SECRET."
      exit 1
    fi
    echo "Logging in to Infisical with the machine identity..."
    INFISICAL_TOKEN="$(infisical login \
      --method=universal-auth \
      --client-id="$INFISICAL_CLIENT_ID" \
      --client-secret="$INFISICAL_CLIENT_SECRET" \
      --domain="$INFISICAL_API_URL" \
      --silent --plain)" || {
      echo "ERROR: Infisical machine-identity login failed."
      exit 1
    }
    export INFISICAL_TOKEN
  fi
}

fetch_infisical_env() {
  mint_infisical_token

  if [ -z "${INFISICAL_TOKEN:-}" ] || [ -z "${INFISICAL_API_URL:-}" ] || [ -z "${INFISICAL_PROJECT_ID:-}" ]; then
    echo "ERROR: INFISICAL_API_URL and INFISICAL_PROJECT_ID must be set, plus either INFISICAL_TOKEN"
    echo "or INFISICAL_CLIENT_ID + INFISICAL_CLIENT_SECRET (preferred: the token is minted at each start)."
    echo "Put them in the host .env next to docker-compose.yml, or in the Dokploy environment; the container fetches secrets at startup."
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

  # Workers wait for the web container to persist the key first. `migrate` runs
  # before the web container starts, so it must not wait for it.
  if [ "${CONTAINER_ROLE:-app}" != "app" ] && [ "${CONTAINER_ROLE:-app}" != "migrate" ]; then
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

if [ "$role" = "app" ] || [ "$role" = "queue" ] || [ "$role" = "scheduler" ] || [ "$role" = "migrate" ]; then
  wait_for_db
  ensure_app_key
fi

if [ "$role" = "app" ] && [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  php artisan migrate --force --no-interaction || true
  php artisan storage:link --force --no-interaction 2>/dev/null || true
fi

chown -R www-data:www-data storage bootstrap/cache public/user-uploads 2>/dev/null || true

case "$role" in
  migrate)
    # One-shot release step, the container equivalent of `make finalize-deploy`.
    # Compose starts the web/queue/scheduler containers only after this exits 0,
    # so a failed migration stops the deploy while the previous release keeps
    # serving. (The `app` role's RUN_MIGRATIONS path swallows failures.)
    # Runs as www-data so files created in the shared storage volume stay
    # writable by PHP-FPM.
    echo "Running release tasks..."
    runuser -u www-data -- php artisan migrate --force --no-interaction
    runuser -u www-data -- php artisan reminders:seed-entity-defaults --no-interaction
    runuser -u www-data -- php artisan translations:clear --no-interaction
    runuser -u www-data -- php artisan cache:clear --no-interaction
    echo "Release tasks finished."
    exit 0
    ;;
  queue)
    echo "Starting queue worker..."
    exec php artisan queue:work "${QUEUE_CONNECTION:-database}" \
      --queue="${QUEUE_NAMES:-default,communication_activities,resolvers,PropertyImport,LeadImport,DealImport,reminders-prepare,reminders-send,ol_webhooks}" \
      --sleep=3 \
      --tries=3 \
      --timeout=300
    ;;
  scheduler)
    echo "Starting scheduler loop..."
    while true; do
      php artisan schedule:run --no-interaction >> /dev/null 2>&1 || true
      sleep 60
    done
    ;;
  app|*)
    exec "$@"
    ;;
esac
