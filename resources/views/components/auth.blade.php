<!doctype html>
<html lang="en">

<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
    <link rel="icon" type="image/png" sizes="16x16" href="{{ $globalSetting->favicon_url }}">
    <link rel="manifest" href="{{ $globalSetting->favicon_url }}">
    <meta name="msapplication-TileColor" content="#003160">
    <meta name="msapplication-TileImage" content="{{ $globalSetting->favicon_url }}">
    <meta name="theme-color" content="#003160">

    <link rel="stylesheet" href="{{ asset('vendor/css/all.min.css') }}" defer="defer">
    <link href="{{ asset('vendor/froiden-helper/helper.css') }}" rel="stylesheet" defer="defer">
    <link type="text/css" rel="stylesheet" media="all" href="{{ asset('css/main.css') }}">
    <link rel="stylesheet" href="{{ asset('css/tailwind.css') }}">

    <title>{{ $globalSetting->global_app_name }}</title>

    @stack('styles')
    <script src="{{ asset('vendor/jquery/jquery.min.js') }}"></script>

    @include('sections.theme_css')
    @if (file_exists(public_path() . '/css/login-custom.css'))
        <link href="{{ asset('css/login-custom.css') }}" rel="stylesheet">
    @endif

    <style>
        :root {
            --hibarr-navy: #003160;
            --hibarr-navy-hover: #002548;
            --hibarr-blue: #1a6bb5;
            --hibarr-blue-hover: #155fa0;
            --hibarr-ink: #1a1f2e;
            --hibarr-muted: #5b6472;
            --hibarr-line: #e2e5ea;
            --hibarr-paper: #ffffff;
        }

        html,
        body.hibarr-auth {
            min-height: 100%;
            margin: 0;
            background: var(--hibarr-navy);
            color: var(--hibarr-ink);
        }

        body.hibarr-auth {
            min-height: 100dvh;
            font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
        }

        .auth-shell {
            position: relative;
            isolation: isolate;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100dvh;
            padding: 48px 20px;
            overflow-x: hidden;
            overflow-y: auto;
        }

        .auth-bg {
            position: absolute;
            inset: 0;
            z-index: -1;
            overflow: hidden;
            pointer-events: none;
            background-color: var(--hibarr-navy);
            background-image:
                radial-gradient(ellipse 90% 70% at 50% -20%, rgba(26, 107, 181, 0.55), transparent 58%),
                radial-gradient(ellipse 55% 45% at 110% 110%, rgba(26, 107, 181, 0.28), transparent 52%),
                radial-gradient(ellipse 40% 35% at -10% 90%, rgba(12, 32, 64, 0.85), transparent 50%);
        }

        .auth-bg::before {
            content: "";
            position: absolute;
            inset: 0;
            background-image:
                linear-gradient(rgba(255, 255, 255, 0.035) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255, 255, 255, 0.035) 1px, transparent 1px);
            background-size: 48px 48px;
            mask-image: radial-gradient(ellipse 70% 65% at 50% 45%, #000 20%, transparent 75%);
        }

        .auth-bg::after {
            content: "";
            position: absolute;
            inset: 0;
            background: radial-gradient(circle at 50% 42%, transparent 0 38%, rgba(0, 31, 64, 0.28) 100%);
        }

        .auth-panel {
            width: 100%;
            max-width: 420px;
            display: flex;
            flex-direction: column;
            align-items: center;
        }

        .auth-logo {
            display: block;
            width: 156px;
            height: auto;
            margin: 0 auto 28px;
        }

        .auth-card {
            width: 100%;
            background: var(--hibarr-paper);
            border-radius: 16px;
            padding: 40px 32px 28px;
            text-align: center;
            border: 1px solid rgba(255, 255, 255, 0.18);
            box-shadow: 0 18px 50px rgba(0, 24, 52, 0.28);
            position: relative;
            overflow: visible;
        }

        .hibarr-auth .auth-card h3,
        .hibarr-auth .auth-title {
            margin: 0 0 24px;
            font-size: 22px;
            font-weight: 600;
            letter-spacing: -0.02em;
            color: var(--hibarr-ink);
            line-height: 1.3;
        }

        .hibarr-auth .auth-sso-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            width: 100%;
            min-height: 48px;
            padding: 12px 16px;
            border: none;
            border-radius: 10px;
            background: var(--hibarr-navy);
            color: #fff !important;
            font-size: 15px;
            font-weight: 600;
            text-decoration: none;
            line-height: 1.2;
            box-shadow: 0 1px 0 rgba(255, 255, 255, 0.18) inset;
            transition: background 0.15s ease, transform 0.1s ease;
        }

        .hibarr-auth .auth-sso-btn:hover,
        .hibarr-auth .auth-sso-btn:focus {
            background: var(--hibarr-navy-hover);
            color: #fff !important;
            text-decoration: none;
            box-shadow: 0 1px 0 rgba(255, 255, 255, 0.18) inset;
        }

        .hibarr-auth .auth-sso-btn:active {
            transform: scale(0.98);
        }

        .hibarr-auth .auth-support {
            margin: 16px 0 0;
            font-size: 13px;
            line-height: 1.5;
            color: var(--hibarr-muted);
        }

        .hibarr-auth .auth-support a {
            display: inline;
            width: auto;
            padding: 0;
            border: none;
            color: var(--hibarr-navy);
            font-weight: 600;
            text-decoration: underline;
            text-underline-offset: 2px;
        }

        .hibarr-auth .auth-support a:hover,
        .hibarr-auth .auth-support a:focus {
            color: var(--hibarr-navy-hover);
            box-shadow: none;
        }

        .hibarr-auth .auth-sso-icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 22px;
            height: 22px;
            font-size: 15px;
            line-height: 1;
        }

        .hibarr-auth .auth-card .form-group {
            text-align: left;
        }

        .hibarr-auth .auth-card .form-group label {
            font-size: 13px;
            font-weight: 600;
            color: var(--hibarr-muted);
        }

        .hibarr-auth .auth-card .form-control {
            border-color: var(--hibarr-line);
            border-radius: 10px;
            color: var(--hibarr-ink);
        }

        .hibarr-auth .auth-card .form-control:focus {
            border-color: #b8d4f0;
            box-shadow: 0 0 0 3px #e8f1fb;
        }

        .hibarr-auth .auth-card .btn-primary {
            background: var(--hibarr-navy) !important;
            border-color: var(--hibarr-navy) !important;
            color: #fff !important;
            border-radius: 10px;
            font-weight: 600;
        }

        .hibarr-auth .auth-card .btn-primary:hover {
            background: var(--hibarr-navy-hover) !important;
            border-color: var(--hibarr-navy-hover) !important;
        }

        .hibarr-auth .forgot_pswd a {
            display: inline-flex;
            border: none;
            padding: 0;
            color: var(--hibarr-muted);
            font-size: 13px;
            text-decoration: underline;
            justify-content: center;
            background: none;
            width: auto;
        }

        .hibarr-auth .forgot_pswd a:hover {
            color: var(--hibarr-blue);
            box-shadow: none;
        }

        .auth-langs {
            margin-top: 20px;
            padding-top: 18px;
            border-top: 1px solid var(--hibarr-line);
        }

        .hibarr-auth .change-lang {
            background: transparent;
            padding: 4px 8px;
            border: none;
            color: var(--hibarr-muted) !important;
            font-size: 12px !important;
            font-weight: 500;
            width: auto;
            display: inline-flex;
            align-items: center;
        }

        .hibarr-auth .change-lang:hover,
        .hibarr-auth .change-lang:focus {
            color: var(--hibarr-blue) !important;
            box-shadow: none;
            border: none;
        }

        .hibarr-auth .auth-langs .dropdown-toggle {
            color: var(--hibarr-muted);
            background: transparent;
            border: none;
            box-shadow: none;
        }

        .auth-foot {
            margin-top: 28px;
            font-size: 12px;
            letter-spacing: 0.04em;
            color: rgba(255, 255, 255, 0.62);
        }

        @media (max-width: 767.98px) {
            .auth-shell {
                padding: 36px 16px;
                justify-content: flex-start;
            }

            .auth-logo {
                width: 140px;
                margin-bottom: 22px;
            }

            .auth-card {
                padding: 32px 20px 22px;
            }
        }

        @media (prefers-reduced-transparency: reduce) {
            .auth-bg::before,
            .auth-bg::after {
                display: none;
            }

            .auth-card {
                box-shadow: 0 8px 24px rgba(0, 24, 52, 0.22);
            }
        }
    </style>
</head>

@php
    $hibarrLogo = config('email.logo.light', 'https://res.cloudinary.com/hibarr/image/upload/v1753433790/hibarr-logo-full-blue_f5xqb0.png');
@endphp

<body
    class="hibarr-auth {{ isRtl() ? (session('changedRtl') === false ? '' : 'rtl') : (session('changedRtl') == true ? 'rtl' : '') }}">

    <main class="auth-shell">
        <div class="auth-bg" aria-hidden="true"></div>

        <div class="auth-panel">
            <div class="auth-card">
                <img class="auth-logo" src="{{ $hibarrLogo }}" alt="HIBARR" width="156" height="40" />

                {{ $slot }}

                @if ($languages->count() > 1)
                    <div class="auth-langs">
                        <div class="flex flex-wrap items-center justify-center gap-2">
                            @foreach ($languages->take(4) as $language)
                                <span class="inline-flex">
                                    <a href="javascript:;"
                                        class="change-lang"
                                        data-lang="{{ $language->language_code }}">
                                        <span class="mr-2 flag-icon flag-icon-{{ $language->flag_code === 'en' ? 'gb' : $language->flag_code }} flag-icon-squared"></span>
                                        {{ \App\Models\LanguageSetting::LANGUAGES_TRANS[$language->language_code] ?? $language->language_name }}
                                    </a>
                                </span>
                            @endforeach

                            @if ($languages->count() > 4)
                                <div class="dropdown" style="z-index:10000">
                                    <a class="btn btn-lg f-14 px-2 py-1 rounded dropdown-toggle"
                                        type="button" id="languageDropdown" data-toggle="dropdown"
                                        aria-haspopup="true" aria-expanded="false">
                                        <i class="fa fa-ellipsis-h"></i>
                                    </a>

                                    <div class="dropdown-menu dropdown-menu-right border-grey rounded b-shadow-4 p-0"
                                        aria-labelledby="languageDropdown"
                                        style="max-height: 600px; overflow-y: auto;">
                                        @foreach ($languages->slice(4) as $language)
                                            <a class="dropdown-item change-lang" href="javascript:;"
                                                data-lang="{{ $language->language_code }}">
                                                <span
                                                    class="mr-2 flag-icon flag-icon-{{ $language->flag_code === 'en' ? 'gb' : $language->flag_code }} flag-icon-squared"></span>
                                                {{ \App\Models\LanguageSetting::LANGUAGES_TRANS[$language->language_code] ?? $language->language_name }}
                                            </a>
                                        @endforeach
                                    </div>
                                </div>
                            @endif
                        </div>
                    </div>
                @endif
            </div>

            {{ $outsideLoginBox ?? '' }}

            <p class="auth-foot">&copy; {{ date('Y') }} HIBARR</p>
        </div>
    </main>

    <script src="{{ asset('vendor/jquery/all.min.js') }}" defer="defer"></script>
    <script src="{{ asset('js/main.js') }}"></script>
    <script>
        document.loading = '@lang('app.loading')';
        const MODAL_DEFAULT = '#myModalDefault';
        const MODAL_LG = '#myModal';
        const MODAL_XL = '#myModalXl';
        const MODAL_HEADING = '#modelHeading';
        const RIGHT_MODAL = '#task-detail-1';
        const RIGHT_MODAL_CONTENT = '#right-modal-content';
        const RIGHT_MODAL_TITLE = '#right-modal-title';

        const dropifyMessages = {
            default: "@lang('app.dragDrop')",
            replace: "@lang('app.dragDropReplace')",
            remove: "@lang('app.remove')",
            error: "@lang('messages.errorOccured')",
        };
        $('.change-lang').click(function(event) {
            const locale = $(this).data("lang");
            event.preventDefault();
            let url = "{{ route('front.changeLang', ':locale') }}";
            url = url.replace(':locale', locale);
            $.easyAjax({
                url: url,
                container: '#login-form',
                blockUI: true,
                type: "GET",
                success: function(response) {
                    if (response.status === 'success') {
                        window.location.reload();
                    }
                }
            })
        });
    </script>

    {{ $scripts }}

</body>

</html>
