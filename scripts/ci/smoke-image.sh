#!/bin/sh
# Base smoke test for the built image, run by the Dockerfile's `smoke` stage (and
# usable by hand: docker run --rm -v "$PWD/scripts/ci:/ci:ro" --entrypoint sh <image> /ci/smoke-image.sh).
# Checks what every role of the image depends on: PHP and its extensions, the nginx
# config (including the /healthz location), and the build outputs the app expects.
set -eu

cd "${APP_DIR:-/var/www/html}"

php -v | head -n 1

# extension_loaded(), not `php -m | grep`: OPcache is a Zend extension and `php -m`
# names it "Zend OPcache" (under "[Zend Modules]"), so grepping for "opcache" never matches.
php -r '
$missing = [];
foreach (["pdo_mysql", "redis", "gd", "intl", "bcmath", "zip", "Zend OPcache", "pcntl", "exif"] as $ext) {
    if (!extension_loaded($ext)) { $missing[] = $ext; }
}
if ($missing) { fwrite(STDERR, "missing php ext: " . implode(", ", $missing) . "\n"); exit(1); }
echo "php extensions ok\n";
'

nginx -t
grep -q 'location = /healthz' /etc/nginx/conf.d/default.conf || { echo "nginx config has no /healthz location"; exit 1; }

test -f public/mix-manifest.json || { echo "missing public/mix-manifest.json (frontend build output)"; exit 1; }
test -f resources/js/ziggy.js || { echo "missing resources/js/ziggy.js"; exit 1; }
test -f public/build-version.json || { echo "missing public/build-version.json (release id)"; exit 1; }

echo "image smoke test passed."
