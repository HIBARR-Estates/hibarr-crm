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

    {{-- Preload all images (including CSS background-image URLs) so Puppeteer waits for them --}}
    <script>
        (function() {
            var urls = new Set();

            // Collect all <img> src attributes
            document.querySelectorAll('img[src]').forEach(function(img) {
                if (img.src && img.src.startsWith('http')) urls.add(img.src);
            });

            // Collect all inline style background-image URLs
            document.querySelectorAll('[style]').forEach(function(el) {
                var style = el.getAttribute('style') || '';
                var matches = style.match(/url\(['"]?(https?:\/\/[^'")\s]+)['"]?\)/g);
                if (matches) {
                    matches.forEach(function(m) {
                        var url = m.replace(/url\(['"]?/, '').replace(/['"]?\)/, '');
                        urls.add(url);
                    });
                }
            });

            // Also check CSS custom properties (--bg-image)
            document.querySelectorAll('[style*="--bg-image"]').forEach(function(el) {
                var val = getComputedStyle(el).getPropertyValue('--bg-image');
                if (val) {
                    var match = val.match(/url\(['"]?(https?:\/\/[^'")\s]+)['"]?\)/);
                    if (match) urls.add(match[1]);
                }
            });

            // Preload each URL into an Image object to force the browser to fetch it
            urls.forEach(function(url) {
                var img = new Image();
                img.src = url;
            });
        })();
    </script>
</body>
</html>
