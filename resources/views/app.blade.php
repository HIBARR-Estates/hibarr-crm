<!DOCTYPE html>
<html class="h-full bg-gray-100">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg">

    {{-- Inertia Head --}}
    @inertiaHead

    {{-- Polyfills (optional) --}}
    <script src="https://cdnjs.cloudflare.com/polyfill/v3/polyfill.min.js?features=smoothscroll,NodeList.prototype.forEach,Promise,Object.values,Object.assign" defer></script>

    {{-- Load your built JS (make sure it's deferred!) --}}
    
    {{-- Debug script --}}
    <script>
        console.log('✅ app.blade.php loaded');
        document.addEventListener('DOMContentLoaded', function() {
            console.log('✅ DOM loaded, looking for #app element:', document.getElementById('app'));
        });
    </script>
</head>
<body class="font-sans leading-none text-gray-700 antialiased">
    {{-- Visual debug banner --}}
    <div style="position: fixed; top: 0; left: 0; background: red; color: white; padding: 5px; z-index: 9999;">
        HTML Loaded - Waiting for React/Inertia...
    </div>

    {{-- Inertia mount point --}}
    @inertia
    <script src="{{ mix('js/inertia.js') }}" defer></script>
</body>
</html>
