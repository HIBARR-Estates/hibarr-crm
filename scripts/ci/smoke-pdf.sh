#!/bin/sh
# Smoke test for Expose PDF rendering, run INSIDE the built image:
#
#   docker run --rm -v "$PWD/scripts/ci:/ci:ro" --entrypoint sh <image> /ci/smoke-pdf.sh
#
# It does what Browsershot does (spatie/browsershot bin/browser.cjs with
# NODE_PATH=`npm root -g`, no explicit Chrome path), once as root (the queue
# worker) and once as www-data (PHP-FPM), and checks a PDF comes out. It also
# fails early, with a readable message, when Chrome's shared libraries or the
# fonts the Expose templates name are missing.
set -eu

cd /var/www/html

echo "node $(node --version), npm root -g: $(npm root -g)"
[ -f vendor/spatie/browsershot/bin/browser.cjs ] || { echo "browsershot's browser.cjs is missing from the image"; exit 1; }

# Every browser binary Puppeteer installed must actually run on this CPU. Puppeteer
# has no Chrome for Testing build for Linux ARM and downloads the x86-64 one there
# without complaint, which then cannot execute (and `ldd`, below, only greps for
# "not found", so it would not notice either).
for browser in $(find -H /opt/puppeteer -type f \( -name chrome -o -name chrome-headless-shell \)); do
    "$browser" --version > /dev/null 2>&1 || {
        echo "Cannot run $browser on this machine (uname -m: $(uname -m))."
        echo "Most likely the browser was built for another CPU architecture: Puppeteer installs the x86-64 Chrome for Testing on Linux ARM hosts."
        exit 1
    }
done

# Every browser binary Puppeteer installed must have all its libraries.
missing="$(find -H /opt/puppeteer -type f \( -name chrome -o -name chrome-headless-shell \) -exec ldd {} \; 2>/dev/null | grep 'not found' || true)"
if [ -n "$missing" ]; then
    echo "Chrome is missing shared libraries:"
    echo "$missing"
    exit 1
fi

# Fonts named by resources/views/pdf (DejaVu Sans, Open Sans, Helvetica/Arial -> Liberation).
for dir in ${FONT_DIRS:-/usr/share/fonts/truetype/dejavu /usr/share/fonts/truetype/open-sans /usr/share/fonts/truetype/liberation}; do
    [ -d "$dir" ] || { echo "missing font directory: $dir"; exit 1; }
done

cat > /tmp/smoke.html <<'HTML'
<!doctype html><html><head><meta charset="utf-8"></head>
<body style="font-family:'DejaVu Sans',sans-serif"><h1 style="font-family:'Open Sans',sans-serif">Expose smoke test</h1>
<p>Straße, İstanbul, Москва, 1.250.000 €</p>
<script>window.__exposePdfImagesReady = true;</script></body></html>
HTML
chmod 644 /tmp/smoke.html

for user in root www-data; do
    out="/tmp/smoke-$user.pdf"
    # The options mirror App\Services\PdfExpose\Generators\PdfGenerator.
    json='{"url":"file:///tmp/smoke.html","action":"pdf","options":{"path":"'"$out"'","format":"A4","printBackground":true,"args":["--no-sandbox","--disable-setuid-sandbox","--disable-dev-shm-usage","--ignore-certificate-errors"],"waitUntil":"load","function":"window.__exposePdfImagesReady === true","functionPolling":"raf","functionTimeout":60000}}'
    cmd="PATH=\$PATH:/usr/local/bin NODE_PATH=\`npm root -g\` node vendor/spatie/browsershot/bin/browser.cjs '$json'"
    echo "Rendering as $user..."
    if [ "$user" = root ]; then
        sh -c "$cmd" > "/tmp/smoke-$user.log" 2>&1 || { cat "/tmp/smoke-$user.log"; exit 1; }
    else
        runuser -u "$user" -- env HOME=/var/www sh -c "$cmd" > "/tmp/smoke-$user.log" 2>&1 || { cat "/tmp/smoke-$user.log"; exit 1; }
    fi
    [ "$(head -c 4 "$out")" = "%PDF" ] || { echo "no PDF produced for $user"; cat "/tmp/smoke-$user.log"; exit 1; }
    echo "  ok: $(stat -c%s "$out") bytes"
done
echo "PDF smoke test passed."
