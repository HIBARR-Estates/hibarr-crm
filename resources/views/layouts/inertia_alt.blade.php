<!DOCTYPE html>
{{-- <html class="h-full bg-gray-100"> --}}
<html class="h-full bg-gray-100" lang="{{ $page['props']['locale'] ?? 'en' }}" dir="{{ ($page['props']['isRtl'] ?? false) ? 'rtl' : 'ltr' }}">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="csrf-token" content="{{ csrf_token() }}">

    <link rel="icon" type="image/png" sizes="16x16" href="{{ companyOrGlobalSetting()->favicon_url }}">

    
    <link rel="icon" type="image/svg+xml" href="/favicon.svg">

    {{-- Add Main CSS --}}
    {{-- <link type="text/css" rel="stylesheet" media="all" href="{{ mix('css/main.css') }}"> --}}

    {{-- Add Tailwind CSS --}}
    @if (config('app.bundler') === 'vite')
        @vite(['resources/css/tailwind.css', 'resources/js/Components/Redesign/redesign.css'])
    @else
        <link type="text/css" rel="stylesheet" media="all" href="{{ mix('css/tailwind.css') }}">
    @endif

    {{-- Inertia Head --}}
    @inertiaHead

    {{-- Polyfills (optional) --}}
    <script src="https://cdnjs.cloudflare.com/polyfill/v3/polyfill.min.js?features=smoothscroll,NodeList.prototype.forEach,Promise,Object.values,Object.assign" defer></script>
</head>
<body class="font-sans leading-none text-gray-700 antialiased">
    

    {{-- Inertia mount point --}}
    @inertia

    @routes
    {{-- A1/A3: initial splitChunks must be script-tagged (runtime stays in inertia.js).
         Order: shared libs first, entry last. Async page chunks (A2) load via Webpack publicPath `/`. --}}
    @if (config('app.bundler') === 'vite')
        @vite('resources/js/inertia.tsx')
    @else
        <script src="{{ mix('js/react.js') }}" defer></script>
        <script src="{{ mix('js/vendor.js') }}" defer></script>
        <script src="{{ mix('js/antd.js') }}" defer></script>
        <script src="{{ mix('js/inertia.js') }}" defer></script>
    @endif
</body>
</html>
