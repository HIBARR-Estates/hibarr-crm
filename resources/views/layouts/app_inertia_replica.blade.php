<!doctype html>
<html lang="en">

<head>
    <!-- Required meta tags -->
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">

    @php
        $company = function_exists('companyOrGlobalSetting') ? companyOrGlobalSetting() : null;
        $pageTitle = $page['props']['pageTitle'] ?? 'Properties';
    @endphp

    <link rel="icon" type="image/png" sizes="16x16" href="{{ $company?->favicon_url ?? '/favicon.ico' }}">

    <!-- Font Awesome Icons -->
    <link rel="stylesheet" href="{{ asset('vendor/css/all.min.css') }}" defer="defer">

    <!-- Simple Line Icons -->
    <link rel="stylesheet" href="{{ asset('vendor/css/simple-line-icons.css') }}" defer="defer">

    <!-- Datepicker -->
    <link rel="stylesheet" href="{{ asset('vendor/css/datepicker.min.css') }}" defer="defer">

    <!-- TimePicker -->
    <link rel="stylesheet" href="{{ asset('vendor/css/bootstrap-timepicker.min.css') }}" defer="defer">

    <!-- Select Plugin -->
    <link rel="stylesheet" href="{{ asset('vendor/css/select2.min.css') }}" defer="defer">

    <!-- Bootstrap Icons -->
    <link rel="stylesheet" href="{{ asset('vendor/css/bootstrap-icons.css') }}" defer="defer">

    <!-- Template CSS -->
    <link type="text/css" rel="stylesheet" media="all" href="{{ asset('css/main.css') }}">
    
    <!-- Tailwind CSS -->
    <link type="text/css" rel="stylesheet" media="all" href="{{ asset('css/tailwind.css') }}">

    <title>{{ is_array(__($pageTitle)) ? $pageTitle : __($pageTitle) }}</title>
    <meta name="msapplication-TileColor" content="#ffffff">
    <meta name="msapplication-TileImage" content="{{ $company?->favicon_url ?? '/favicon.ico' }}">
    <meta name="theme-color" content="#ffffff">
    <meta name="csrf-token" content="{{ csrf_token() }}"/>
    
    @inertiaHead
    
    <style>
        :root {
            --fc-border-color: #E8EEF3;
            --fc-button-text-color: #99A5B5;
            --fc-button-border-color: #99A5B5;
            --fc-button-bg-color: #ffffff;
            --fc-button-active-bg-color: #171f29;
            --fc-today-bg-color: #f2f4f7;
        }

        .fc a[data-navlink] {
            color: #99a5b5;
        }

        .ql-editor p {
            line-height: 1.42;
            margin: revert;
        }

        .table [contenteditable="true"] {
            height: 55px;
        }

        p {
            word-break: break-word;
        }

        .inactive {
            opacity: 0.7;
        }

        /* Inertia specific styles */
        .inertia-container {
            min-height: 100vh;
            padding: 20px;
        }
    </style>

    {{-- Custom theme styles --}}
    @if (function_exists('user') && user() && !user()->dark_theme)
        @include('sections.theme_css')
    @endif

    @if (file_exists(public_path() . '/css/app-custom.css'))
        <link href="{{ asset('css/app-custom.css') }}" rel="stylesheet">
    @endif

    @if (file_exists(public_path() . '/css/theme-custom.css'))
        <link href="{{ asset('css/theme-custom.css') }}" rel="stylesheet">
    @endif

    <script src="{{ asset('vendor/jquery/jquery.min.js') }}"></script>
    <script src="{{ asset('vendor/jquery/modernizr.min.js') }}"></script>

    <script>
        window.Laravel = {!! json_encode([
            'csrfToken' => csrf_token(),
            'user' => function_exists('user') ? user() : null,
        ]) !!};
        
        // Simple route helper for development
        window.route = function (name, params, absolute) {
            const routes = {
                "properties.index": "/account/properties",
                "properties.create": "/account/properties/create",
                "properties.show": "/account/properties/{id}",
                "properties.edit": "/account/properties/{id}/edit",
                "properties.store": "/account/properties",
                "properties.update": "/account/properties/{id}",
                "properties.destroy": "/account/properties/{id}",
            };

            let url = routes[name] || `/${name}`;

            if (params && typeof params === 'object') {
                Object.keys(params).forEach(key => {
                    url = url.replace(`{${key}}`, params[key]);
                });
            }

            return absolute ? `{{ url('') }}${url}` : url;
        };
    </script>
</head>

<body id="body" class="{{ function_exists('user') && user() && user()->dark_theme ? 'dark-theme' : '' }}">
    {{-- Include topbar only if user exists --}}
    @if(function_exists('user') && user())
        @include('sections.topbar')
        @include('sections.sidebar')
    @endif

    <!-- BODY WRAPPER START -->
    <div class="clearfix body-wrapper">
        <!-- MAIN CONTAINER START -->
        <section class="mb-5 main-container bg-additional-grey mb-sm-0" id="fullscreen">
            <div class="preloader-container d-flex justify-content-center align-items-center">
                <div class="spinner-border" role="status" aria-hidden="true"></div>
            </div>

            {{-- Inertia App Mount Point --}}
            @inertia
        </section>
        <!-- MAIN CONTAINER END -->
    </div>
    <!-- BODY WRAPPER END -->

    {{-- Include modals only if user exists --}}
    @if(function_exists('user') && user())
        @include('sections.modals')
    @endif

    <!-- Global Required Javascript -->
    <script src="{{ asset('js/main.js') }}"></script>
    <!-- Inertia.js React App -->
    <script src="{{ asset('js/inertia.js') }}" defer></script>

    <script>
        $(window).on('load', function () {
            $(".preloader-container").fadeOut("slow", function () {
                $(this).removeClass("d-flex");
            });
        });
    </script>
</body>
</html>