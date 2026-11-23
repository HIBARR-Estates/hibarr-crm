#!/usr/bin/env bash
# HIBARR CI Infrastructure — shared deploy + release check (laravel-app)
#
# Like deploy-health-check.sh (fires the Dokploy webhook, then polls HEALTH_URL),
# but sized for an app that boots slowly and verifies that the NEW release is the
# one answering, not just that something is. A Laravel container fetches secrets,
# waits for the database and runs migrations before it can answer, so the
# backend-service script's 6 x 7s budget is far too short, and an old container that
# is still up would pass a plain "HTTP 200" check.
#
# Release check: when HEALTH_URL ends in /healthz, the app's build id is read from
# <same origin>/build-version.json (written into the image at build time as
# "<pipeline number>-<7-char commit sha>") and must contain the pipeline's SHORT_SHA.
# For any other HEALTH_URL only the HTTP status is checked.
#
# Env:
#   DOKPLOY_WEBHOOK, HEALTH_URL, IMAGE_NAME, CI_BRANCH_TAG, SHORT_SHA   (required)
#   HEALTH_MAX_ATTEMPTS      default 30
#   HEALTH_INTERVAL_SECONDS  default 10   (so ~5 minutes by default)

set -euo pipefail

: "${DOKPLOY_WEBHOOK:?DOKPLOY_WEBHOOK is required}"
: "${HEALTH_URL:?HEALTH_URL is required}"
: "${IMAGE_NAME:?IMAGE_NAME is required}"
: "${CI_BRANCH_TAG:?CI_BRANCH_TAG is required}"
: "${SHORT_SHA:?SHORT_SHA is required}"

maxAttempts="${HEALTH_MAX_ATTEMPTS:-30}"
intervalSeconds="${HEALTH_INTERVAL_SECONDS:-10}"

curl -sf -X POST "$DOKPLOY_WEBHOOK" \
  -H "Content-Type: application/json" \
  -d "{\"image\":\"${IMAGE_NAME}:${CI_BRANCH_TAG}-${SHORT_SHA}\"}"
echo
echo "Deploy triggered for ${IMAGE_NAME}:${CI_BRANCH_TAG}-${SHORT_SHA}"

versionUrl=""
case "$HEALTH_URL" in
  */healthz) versionUrl="${HEALTH_URL%/healthz}/build-version.json" ;;
esac

attempt=1
while [ "$attempt" -le "$maxAttempts" ]; do
  httpStatus=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$HEALTH_URL" || true)

  if [ "$httpStatus" = "200" ]; then
    if [ -z "$versionUrl" ]; then
      echo "Health check passed (attempt $attempt)"
      exit 0
    fi
    liveBuild=$(curl -s --max-time 10 "$versionUrl" || true)
    case "$liveBuild" in
      *"-${SHORT_SHA}"*)
        echo "Release ${SHORT_SHA} is live and healthy (attempt $attempt)"
        exit 0
        ;;
    esac
    echo "Attempt $attempt: healthy, but still serving another release (${liveBuild:-no build id}) — retrying in ${intervalSeconds}s..."
  else
    echo "Attempt $attempt: HTTP ${httpStatus:-000} — retrying in ${intervalSeconds}s..."
  fi

  sleep "$intervalSeconds"
  attempt=$((attempt + 1))
done

echo "Release ${SHORT_SHA} was not live and healthy after $maxAttempts attempts" >&2
exit 1
