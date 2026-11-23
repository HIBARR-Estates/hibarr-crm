#!/bin/sh
# Smoke test for the gRPC server, run INSIDE the built image:
#
#   docker run --rm -v "$PWD/scripts/ci:/ci:ro" --entrypoint sh <image> /ci/smoke-grpc.sh
#   docker run --rm -v "$PWD/scripts/ci:/ci:ro" -e GRPC_BOOT=1 --entrypoint sh <image> /ci/smoke-grpc.sh
#
# Always: the RoadRunner binary matches composer.lock, worker.php parses, every
# class it imports and every generated protobuf class autoloads, and a message
# round-trips through the installed protobuf runtime.
# With GRPC_BOOT=1: also start RoadRunner with the real worker.php and wait for
# the gRPC listener, which proves the Laravel boot inside the workers, the
# proto list in the RoadRunner config and the -o overrides the entrypoint uses.
set -eu

# Resolve this script's directory before changing directory, so a relative $0 works.
here="$(cd "$(dirname "$0")" && pwd)"
cd "${APP_DIR:-/var/www/html}"

expected="$(php -r '$l = json_decode(file_get_contents("composer.lock"), true); foreach ($l["packages"] as $p) { if ($p["name"] === "spiral/roadrunner") { echo ltrim($p["version"], "v"); } }')"
[ -n "$expected" ] || { echo "spiral/roadrunner is not in composer.lock"; exit 1; }
actual="$(rr --version 2>&1 | head -n 1)"
echo "rr: ${actual} (composer.lock pins spiral/roadrunner ${expected})"
case "$actual" in
    *"$expected"*) ;;
    *) echo "RoadRunner binary does not match composer.lock: rebuild the image or bump the pin."; exit 1 ;;
esac

php -l worker.php > /dev/null

config="${RR_CONFIG:-.rr.staging.yaml}"
for proto in $(grep -o 'proto/[A-Za-z_]*\.proto' "$config"); do
    [ -f "$proto" ] || { echo "$config lists $proto, which is not in the image"; exit 1; }
done

php "$here/check-grpc-classes.php"

if [ "${GRPC_BOOT:-}" != "1" ]; then
    echo "gRPC smoke test passed."
    exit 0
fi

# Boot test. High ports so it cannot clash with anything; no database is
# provided, so this also shows the workers boot without touching one.
echo "Starting RoadRunner..."
APP_KEY="${APP_KEY:-base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=}" \
APP_ENV=production LOG_CHANNEL=stderr DB_CONNECTION=sqlite DB_DATABASE=:memory: \
    rr serve -c "$config" -o "grpc.listen=tcp://127.0.0.1:19001" -o "status.address=127.0.0.1:12114" \
    > /tmp/rr.log 2>&1 &
pid=$!

up=0
for _ in $(seq 1 60); do
    if ! kill -0 "$pid" 2> /dev/null; then
        echo "RoadRunner exited early:"; tail -n 40 /tmp/rr.log; exit 1
    fi
    if bash -c 'exec 3<>/dev/tcp/127.0.0.1/19001' 2> /dev/null; then up=1; break; fi
    sleep 2
done

if [ "$up" != "1" ]; then
    echo "gRPC listener did not open within 2 minutes:"; tail -n 40 /tmp/rr.log
    kill "$pid" 2> /dev/null || true
    exit 1
fi

echo "gRPC listener is up."
kill -TERM "$pid"
wait "$pid" 2> /dev/null || true
echo "gRPC smoke test passed (including boot)."
