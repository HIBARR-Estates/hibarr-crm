#!/usr/bin/env bash
# HIBARR CI Infrastructure — run the first npm script that exists, from a list of
# candidate names, and fail loudly if none exist.
#
# Why this exists: consuming repos don't all use the same script name for the same
# concern. hibarr-backend has test:typecheck (not typecheck) and test:ci (not test);
# notification-system has typecheck and test (not test:ci). A plain
# `npm run typecheck --if-present` silently no-ops for hibarr-backend, which means the
# typecheck gate would quietly stop running for that repo once synced — worse than a
# visible pipeline failure. This script checks package.json directly and only
# succeeds if one of the candidates actually ran.
#
# Usage: run-first-available-script.sh <candidate1> [candidate2 ...]

set -euo pipefail

if [ "$#" -eq 0 ]; then
  echo "run-first-available-script.sh: no candidate script names given" >&2
  exit 1
fi

for candidateName in "$@"; do
  hasScript=$(node -e "
    const pkg = require('./package.json');
    const name = process.argv[1];
    process.stdout.write(pkg.scripts && pkg.scripts[name] ? 'yes' : 'no');
  " "$candidateName")

  if [ "$hasScript" = "yes" ]; then
    echo "Running npm script: ${candidateName}"
    exec npm run "${candidateName}"
  fi
done

echo "None of the candidate npm scripts exist in package.json: $*" >&2
exit 1
