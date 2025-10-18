<!DOCTYPE html>
<html class="h-full bg-gray-100">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="csrf-token" content="{{ csrf_token() }}">

    <link rel="icon" type="image/png" sizes="16x16" href="{{ companyOrGlobalSetting()->favicon_url }}">

    
    <link rel="icon" type="image/svg+xml" href="/favicon.svg">

    {{-- Add Main CSS --}}
    {{-- <link type="text/css" rel="stylesheet" media="all" href="{{ mix('css/main.css') }}"> --}}

    {{-- Add Tailwind CSS --}}
    <link type="text/css" rel="stylesheet" media="all" href="{{ mix('css/tailwind.css') }}">

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
    

    {{-- Inertia mount point --}}
    @inertia

    @routes
    <script src="{{ mix('js/inertia.js') }}" defer></script>
</body>
</html>
