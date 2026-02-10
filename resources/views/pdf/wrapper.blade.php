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

    {{-- Images are now embedded as base64 data URIs by TemplateRenderer.
         This minimal preloader handles any remaining remote URLs as a safety net. --}}
    <script>
        (function() {
            var urls = new Set();
            document.querySelectorAll('img[src]').forEach(function(img) {
                if (img.src && img.src.startsWith('http')) urls.add(img.src);
            });
            document.querySelectorAll('[style]').forEach(function(el) {
                var matches = (el.getAttribute('style') || '').match(/url\(['"]?(https?:\/\/[^'")\s]+)['"]?\)/g);
                if (matches) matches.forEach(function(m) {
                    urls.add(m.replace(/url\(['"]?/, '').replace(/['"]?\)/, ''));
                });
            });
            urls.forEach(function(url) { new Image().src = url; });
        })();
    </script>
</body>
</html>
