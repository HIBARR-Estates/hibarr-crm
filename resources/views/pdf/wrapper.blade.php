<!DOCTYPE html>
<html>
<head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
    <title>Expose</title>
    <style>
        @page {
            margin: 0;
        }
        body {
            font-family: 'DejaVu Sans', sans-serif;
            margin: 0;
            padding: 0;
            color: #333;
            background: #fff;
        }
        * {
            box-sizing: border-box;
        }
        .page-break {
            page-break-after: always;
        }
    </style>
</head>
<body>
    {!! $content !!}

    <script>
        (function() {
            // Browsershot waits for this flag. Never leave it false indefinitely —
            // hung Minio URLs can otherwise block PDF generation for the full process timeout.
            var PER_IMAGE_TIMEOUT_MS = 20000;
            var MAX_WAIT_MS = 90000;
            var markedReady = false;

            function markReady() {
                if (markedReady) {
                    return;
                }
                markedReady = true;
                window.__exposePdfImagesReady = true;
            }

            function withTimeout(promise, ms) {
                return Promise.race([
                    promise,
                    new Promise(function(resolve) {
                        setTimeout(resolve, ms);
                    }),
                ]);
            }

            function collectRemoteUrls() {
                var urls = new Set();

                document.querySelectorAll('img[src]').forEach(function(img) {
                    if (img.src && img.src.indexOf('http') === 0) {
                        urls.add(img.src);
                    }
                });

                document.querySelectorAll('[style]').forEach(function(el) {
                    var matches = (el.getAttribute('style') || '').match(/url\(['"]?(https?:\/\/[^'")\s]+)['"]?\)/g);
                    if (matches) {
                        matches.forEach(function(m) {
                            urls.add(m.replace(/url\(['"]?/, '').replace(/['"]?\)/, ''));
                        });
                    }
                });

                return Array.from(urls);
            }

            function waitForImgElement(img) {
                if (img.complete) {
                    return Promise.resolve();
                }

                return new Promise(function(resolve) {
                    img.onload = resolve;
                    img.onerror = resolve;
                });
            }

            function preloadUrl(url) {
                return new Promise(function(resolve) {
                    var img = new Image();
                    img.onload = resolve;
                    img.onerror = resolve;
                    img.src = url;
                });
            }

            var pending = [];

            document.querySelectorAll('img[src]').forEach(function(img) {
                pending.push(withTimeout(waitForImgElement(img), PER_IMAGE_TIMEOUT_MS));
            });

            collectRemoteUrls().forEach(function(url) {
                pending.push(withTimeout(preloadUrl(url), PER_IMAGE_TIMEOUT_MS));
            });

            // Hard cap — proceed even if some assets are still loading.
            setTimeout(markReady, MAX_WAIT_MS);

            if (pending.length === 0) {
                markReady();
                return;
            }

            Promise.all(pending).then(markReady);
        })();
    </script>
</body>
</html>
