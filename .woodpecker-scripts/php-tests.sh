#!/usr/bin/env bash
# HIBARR CI Infrastructure — shared PHPUnit step, sharded (laravel-app)
#
# Splits the test files across PHPUnit processes that run side by side in one
# container, so a suite finishes in roughly the time of its slowest shard instead
# of the sum. No paratest dependency (not every consuming repo has it, and a
# lock-file change just for CI is not worth it).
#
# How it splits: test files are sorted largest first and each goes to the shard
# with the least total bytes so far (file size is a good-enough, deterministic
# proxy for run time). Each shard gets its own phpunit config, written next to
# phpunit.xml (PHPUnit resolves relative paths from the config file's directory)
# by swapping only the <testsuites> block, so the <php> env, bootstrap and
# coverage settings stay the single source of truth in phpunit.xml.
#
# Output: each shard logs to .phpunit-shards/shard-N.log; every log is printed at
# the end, failures last, so a red run shows its failure at the bottom.
#
# Env (all optional):
#   PHPUNIT_SHARDS      number of parallel shards            (default: 4)
#   PHPUNIT_SUITE_DIRS  directories holding *Test.php files  (default: "tests/Unit tests/Feature")
#   PHPUNIT_BIN         phpunit binary                       (default: vendor/bin/phpunit)
#
# Requires: bash, php, awk, find (all in the official php image); phpunit.xml with
# a <testsuites> block on its own lines, as Laravel ships it.

set -euo pipefail

shardCount="${PHPUNIT_SHARDS:-4}"
suiteDirs="${PHPUNIT_SUITE_DIRS:-tests/Unit tests/Feature}"
phpunitBin="${PHPUNIT_BIN:-vendor/bin/phpunit}"
shardDir=".phpunit-shards"

mkdir -p "$shardDir"

# shellcheck disable=SC2086 # word splitting of the directory list is intended
find $suiteDirs -type f -name '*Test.php' -printf '%s %p\n' \
  | sort -k1,1nr -k2 \
  | awk -v shards="$shardCount" '
      {
        lightest = 1
        for (i = 2; i <= shards; i++) if (load[i] < load[lightest]) lightest = i
        load[lightest] += $1
        print lightest, $2
      }' > "$shardDir/assignment.txt"

totalFiles=$(wc -l < "$shardDir/assignment.txt" | tr -d ' ')
[ "$totalFiles" -gt 0 ] || { echo "No *Test.php files found under: $suiteDirs" >&2; exit 1; }
echo "Running $totalFiles test files in $shardCount parallel shards"

pids=()
for shardNumber in $(seq 1 "$shardCount"); do
  suiteBlock="    <testsuites>
        <testsuite name=\"shard-${shardNumber}-of-${shardCount}\">"
  while IFS= read -r testFile; do
    suiteBlock="${suiteBlock}
            <file>./${testFile}</file>"
  done < <(awk -v s="$shardNumber" '$1 == s { print $2 }' "$shardDir/assignment.txt" | sort)
  suiteBlock="${suiteBlock}
        </testsuite>
    </testsuites>"

  awk -v block="$suiteBlock" '
    /<testsuites>/  { print block; skipping = 1 }
    !skipping       { print }
    /<\/testsuites>/ { skipping = 0 }
  ' phpunit.xml > "phpunit.shard-${shardNumber}.xml"

  shardFiles=$(grep -c '<file>' "phpunit.shard-${shardNumber}.xml" || true)
  echo "  shard ${shardNumber}: ${shardFiles} files"

  php -d memory_limit=-1 "$phpunitBin" -c "phpunit.shard-${shardNumber}.xml" --colors=never \
    > "$shardDir/shard-${shardNumber}.log" 2>&1 &
  pids+=("$!")
done

failedShards=()
for index in "${!pids[@]}"; do
  shardNumber=$((index + 1))
  if ! wait "${pids[$index]}"; then
    failedShards+=("$shardNumber")
  fi
done

# Passing shards first, failing ones last (that is where the eye lands).
for shardNumber in $(seq 1 "$shardCount"); do
  case " ${failedShards[*]:-} " in *" ${shardNumber} "*) continue ;; esac
  echo "::: shard ${shardNumber} passed"
  tail -n 6 "$shardDir/shard-${shardNumber}.log"
done
for shardNumber in "${failedShards[@]:-}"; do
  [ -n "$shardNumber" ] || continue
  echo "::: shard ${shardNumber} FAILED"
  cat "$shardDir/shard-${shardNumber}.log"
done

if [ "${#failedShards[@]}" -gt 0 ]; then
  echo "Failed shards: ${failedShards[*]}" >&2
  exit 1
fi
echo "All ${shardCount} shards passed."
