@php
    $staleBuildId = \App\Support\AppBuild::clientId();
@endphp
@if ($staleBuildId)
    <meta name="app-build" content="{{ $staleBuildId }}">
    <script src="{{ mix('js/stale-build-banner.js') }}" defer></script>
@endif
