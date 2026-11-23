#!/usr/bin/env bash
# HIBARR CI Infrastructure — shared PHP style + static-analysis step (laravel-app)
#
# Runs Laravel Pint (--test, no rewriting) and PHPStan over the PHP files THIS
# pipeline run changed, not the whole repo, so a repo with a legacy baseline is not
# red on day one and a PR only answers for what it touches. Woodpecker exposes the
# changed files as CI_PIPELINE_FILES (a JSON array, set for push and pull_request
# events); with no PHP files in it this exits 0.
#
# The template runs this step with `failure: ignore` while a repo's baseline is
# unknown. Remove that line from the template to make it a gate.
#
# Env (all optional):
#   PHPSTAN_PATHS_REGEX  which changed files PHPStan analyses  (default: ^(app|database)/ —
#                        phpstan.neon.dist's paths, so test files are not analysed
#                        without the config's extensions)
#
# Requires: php, vendor/bin/pint, vendor/bin/phpstan (composer require-dev packages).

set -euo pipefail

phpstanPathsRegex="${PHPSTAN_PATHS_REGEX:-^(app|database)/}"

changedPhpFiles="$(php -r '
  $files = json_decode(getenv("CI_PIPELINE_FILES") ?: "[]", true) ?: [];
  foreach ($files as $file) {
    if (substr($file, -4) === ".php" && is_file($file)) { echo $file, "\n"; }
  }
')"

if [ -z "$changedPhpFiles" ]; then
  echo "No changed PHP files in this run."
  exit 0
fi

echo "Changed PHP files:"
echo "$changedPhpFiles" | sed 's/^/  /'

status=0

echo "--- Pint"
echo "$changedPhpFiles" | xargs vendor/bin/pint --test || status=1

phpstanFiles="$(echo "$changedPhpFiles" | grep -E -- "$phpstanPathsRegex" || true)"
if [ -n "$phpstanFiles" ]; then
  echo "--- PHPStan"
  # Laravel boots the app for larastan; it needs an env file to exist.
  [ -f .env ] || cp .env.example .env
  echo "$phpstanFiles" | xargs vendor/bin/phpstan analyse --no-progress --memory-limit=1G || status=1
fi

exit "$status"
