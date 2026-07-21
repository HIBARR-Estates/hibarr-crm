<!DOCTYPE html>
<html class="h-full bg-gray-100" lang="{{ $page['props']['locale'] ?? 'en' }}" dir="{{ ($page['props']['isRtl'] ?? false) ? 'rtl' : 'ltr' }}">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="csrf-token" content="{{ csrf_token() }}">

    <link rel="icon" type="image/png" sizes="16x16" href="{{ companyOrGlobalSetting()->favicon_url }}">
    <link rel="icon" type="image/svg+xml" href="/favicon.svg">

    {{-- ✅ React Fast Refresh preamble must come first --}}
    @viteReactRefresh

    {{-- ✅ Then load your Vite entrypoints --}}
    @vite(['resources/js/inertia.tsx', 'resources/css/tailwind.css'])

    {{-- Optional Mix assets for legacy --}}
    <link type="text/css" rel="stylesheet" media="all" href="{{ mix('css/tailwind.css') }}">

    @inertiaHead
</head>
<body class="font-sans leading-none text-gray-700 antialiased">
    @inertia
    @routes
</body>
</html>
