@php
    $staleBuildId = \App\Support\AppBuild::clientId();
@endphp
@if ($staleBuildId)
    <meta name="app-build" content="{{ $staleBuildId }}">
    @if (config('app.bundler') === 'vite')
        @vite('resources/js/stale-build-banner.ts')
    @else
        <script src="{{ mix('js/stale-build-banner.js') }}" defer></script>
    @endif
@endif
