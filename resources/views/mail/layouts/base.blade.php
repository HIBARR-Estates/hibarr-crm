<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light dark">
    <meta name="supported-color-schemes" content="light dark">
    <title>@yield('title') - {{ config('app.name') }}</title>
    <style>
        :root {
            color-scheme: light dark;
            supported-color-schemes: light dark;
        }

        .hm,
        .hm table,
        .hm td,
        .hm p,
        .hm a {
            -ms-text-size-adjust: 100%;
            -webkit-text-size-adjust: 100%;
        }

        .hm table {
            border-collapse: collapse;
        }

        .hm img {
            border: 0;
            height: auto;
            line-height: 100%;
            outline: none;
            text-decoration: none;
            display: block;
        }

        .hm .content p {
            margin: 0 0 16px;
            font-family: "Syne", Georgia, serif;
            font-size: 14px;
            line-height: 22px;
            color: #0a0e1a;
        }

        .hm .content p:last-child {
            margin-bottom: 0;
        }

        .hm .content a {
            color: #003160;
            text-decoration: underline;
            font-family: "DM Mono", "Consolas", monospace;
            font-size: 14px;
            line-height: 22px;
        }

        .hm .greeting-text {
            margin: 0 0 16px;
            font-family: "Syne", Georgia, serif;
            font-size: 14px;
            line-height: 22px;
            color: #0a0e1a;
        }

        .hm .callout {
            border-top: 1px solid #d5dce8;
            margin: 20px 0 0;
            padding: 20px 0 0;
            font-family: "Syne", Georgia, serif;
            font-size: 14px;
            line-height: 22px;
            color: #0a0e1a;
        }

        .hm .detail-block {
            border-top: 1px solid #d5dce8;
            margin: 20px 0 0;
            padding: 20px 0 0;
        }

        .hm .detail-title {
            font-family: "Syne", Georgia, serif;
            font-size: 20px;
            font-weight: 700;
            color: #0a0e1a;
            line-height: 1.2;
            margin-bottom: 8px;
        }

        .hm .detail-meta {
            font-family: "DM Mono", "Consolas", monospace;
            font-size: 14px;
            color: #4a5272;
            line-height: 1.6;
            margin-bottom: 4px;
        }

        .hm .detail-warning {
            color: #b45309;
            font-family: "Syne", Georgia, serif;
            font-size: 14px;
            font-weight: 600;
        }

        .hm .closing-text,
        .hm .strong-text {
            font-family: "Syne", Georgia, serif;
            font-size: 14px;
            line-height: 22px;
            color: #0a0e1a;
        }

        .dark-logo {
            display: none !important;
        }

        .light-logo {
            display: block !important;
        }

        @media (prefers-color-scheme: dark) {
            .hm .outer-bg {
                background-color: #0a0e1a !important;
            }

            .hm .shell {
                background-color: #121826 !important;
                border-color: #2a3348 !important;
            }

            .hm .header-border,
            .hm .footer-border {
                border-color: #2a3348 !important;
            }

            .hm .footer-bg {
                background-color: #0f1420 !important;
            }

            .hm .content p,
            .hm .greeting-text,
            .hm .callout,
            .hm .detail-title,
            .hm .closing-text,
            .hm .strong-text {
                color: #e5e7eb !important;
            }

            .hm .detail-meta {
                color: #9ca3af !important;
            }

            .hm .detail-warning {
                color: #fbbf24 !important;
            }

            .hm .detail-block {
                border-color: #2a3348 !important;
            }

            .hm .content a {
                color: #93c5fd !important;
            }

            .hm .badge-label {
                color: #93c5fd !important;
            }

            .hm .badge-accent {
                background-color: #93c5fd !important;
            }

            .hm .top-bar {
                background-color: #2563eb !important;
            }

            .hm .footer-links a,
            .hm .footer-copy {
                color: #8a94b0 !important;
            }

            .dark-logo {
                display: block !important;
            }

            .light-logo {
                display: none !important;
            }
        }

        @media only screen and (max-width: 620px) {
            .hm .outer-wrap {
                padding: 20px 8px !important;
            }

            .hm .shell {
                width: 100% !important;
            }

            .hm .mp {
                padding-left: 20px !important;
                padding-right: 20px !important;
            }

            .hm .mg {
                padding-top: 24px !important;
                padding-bottom: 24px !important;
            }

            .hm .footer-links a,
            .hm .footer-copy {
                font-size: 12px !important;
                line-height: 18px !important;
            }

            .hm .cta-cell a {
                display: block !important;
                text-align: center !important;
            }
        }
    </style>
</head>
<body style="margin:0;padding:0;background-color:#eef2f8;">
@php
    $capPreheaderText = static function (mixed $value): string {
        $text = is_string($value) ? $value : (string) ($value ?? '');
        if ($text !== '' && mb_strlen($text) > 2000) {
            $text = mb_substr($text, 0, 2000);
        }

        return trim($text);
    };

    $layoutPreheader = $capPreheaderText($preheader ?? '');
    if ($layoutPreheader === '') {
        $layoutPreheader = $capPreheaderText((string) $__env->yieldContent('preheader'));
    }
    if ($layoutPreheader === '') {
        $layoutPreheader = $capPreheaderText((string) $__env->yieldContent('intro'));
    }
    if ($layoutPreheader === '') {
        $layoutPreheader = $capPreheaderText((string) $__env->yieldContent('title'));
    }
    if ($layoutPreheader === '') {
        $layoutPreheader = __('email.defaultPreheader');
    }

    // @section('name', $value) inline form pre-escapes $value (Laravel's startSection
    // calls e() on it); decode here so the {{ }} below doesn't double-escape entities
    // like apostrophes (was rendering "You&amp;#039;re" instead of "You're").
    $badgeLabel = trim(html_entity_decode((string) $__env->yieldContent('badgeLabel'), ENT_QUOTES, 'UTF-8'));
    if ($badgeLabel === '') {
        $badgeLabel = trim(html_entity_decode((string) $__env->yieldContent('title'), ENT_QUOTES, 'UTF-8'));
    }
    if ($badgeLabel === '') {
        $badgeLabel = config('app.name');
    }

    // Same pre-escaped-by-@section issue as $badgeLabel above — decode before the
    // {{ }} echo below re-escapes, otherwise action URLs with query strings break
    // ("&" -> "&amp;" -> "&amp;amp;") and text gets double-encoded entities.
    $actionText = trim(html_entity_decode((string) $__env->yieldContent('actionText'), ENT_QUOTES, 'UTF-8'));
    $actionUrl = trim(html_entity_decode((string) $__env->yieldContent('actionUrl'), ENT_QUOTES, 'UTF-8'));
    $actionDescription = trim(html_entity_decode((string) $__env->yieldContent('actionDescription'), ENT_QUOTES, 'UTF-8'));
    $footerNote = trim(html_entity_decode((string) $__env->yieldContent('footerNote'), ENT_QUOTES, 'UTF-8'));
    $subfooter = trim(html_entity_decode((string) $__env->yieldContent('subfooter'), ENT_QUOTES, 'UTF-8'));
    $closingSection = trim(html_entity_decode((string) $__env->yieldContent('closing'), ENT_QUOTES, 'UTF-8'));
    $layoutNotifiableName = trim(html_entity_decode((string) $__env->yieldContent('notifiableName'), ENT_QUOTES, 'UTF-8'));
    $showClosing = $closingSection !== 'none';
@endphp

@include('mail.partials.preheader', ['preheader' => $layoutPreheader])

<div style="font-size:10pt;font-family:Verdana,Arial,Helvetica,sans-serif">
    <div class="hm" style="margin:0;padding:0;width:100%">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="outer-bg" style="background-color:#eef2f8">
            <tr>
                <td align="center" class="outer-wrap" style="padding:32px 12px">
                    <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" align="center" class="shell" style="width:600px;max-width:600px;background-color:#ffffff;border:1px solid #d5dce8">
                        <tr>
                            <td class="top-bar" style="height:3px;background-color:#003160;font-size:0;line-height:0">&nbsp;</td>
                        </tr>
                        <tr>
                            <td class="mp mg header-border" style="padding:32px 40px 24px;border-bottom:1px solid #d5dce8">
                                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                    <tr>
                                        <td align="left">
                                            <img src="{{ config('email.logo.light', 'https://res.cloudinary.com/hibarr/image/upload/v1753433790/hibarr-logo-full-blue_f5xqb0.png') }}"
                                                 alt="{{ config('app.name') }}"
                                                 width="140"
                                                 height="36"
                                                 class="light-logo"
                                                 style="display:block;width:140px;height:auto" />
                                            <img src="{{ config('email.logo.dark', 'https://res.cloudinary.com/hibarr/image/upload/v1752237736/logo_ywr5n3.png') }}"
                                                 alt="{{ config('app.name') }}"
                                                 width="140"
                                                 height="36"
                                                 class="dark-logo"
                                                 style="display:none;width:140px;height:auto" />
                                        </td>
                                    </tr>
                                    <tr>
                                        <td class="badge-label" style="padding-top:16px;font-family:'DM Mono',monospace;font-size:11px;line-height:16px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#003160">
                                            <span class="badge-accent" style="display:inline-block;width:18px;height:2px;background-color:#003160;vertical-align:middle;margin-right:10px"></span>{{ $badgeLabel }}
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        <tr>
                            <td class="content mp" style="padding:32px 40px 40px">
                                @if($layoutNotifiableName !== '')
                                    <p class="greeting-text">
                                        @lang('email.hello') <strong>{{ $layoutNotifiableName }}</strong>,
                                    </p>
                                @endif

                                @hasSection('intro')
                                    <p>@yield('intro')</p>
                                @else
                                    <p>{{ __('email.defaultPreheader') }}</p>
                                @endif

                                @hasSection('detail')
                                    @yield('detail')
                                @endif

                                @hasSection('content')
                                    <div class="callout">
                                        @yield('content')
                                    </div>
                                @endif

                                @if($actionText !== '' && $actionUrl !== '')
                                    @if($actionDescription !== '')
                                        <p style="margin-top:20px">{{ $actionDescription }}</p>
                                    @endif

                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0 24px">
                                        <tr>
                                            <td bgcolor="#003160" class="cta-cell">
                                                <a href="{{ $actionUrl }}" target="_blank" rel="noopener" aria-label="{{ $actionText }}" style="display:inline-block;background-color:#003160;color:#ffffff;font-family:'DM Mono',Consolas,monospace;font-size:12px;font-weight:700;letter-spacing:0.10em;text-decoration:none;padding:13px 28px;text-transform:uppercase">{{ $actionText }} &rarr;</a>
                                            </td>
                                        </tr>
                                    </table>
                                @endif

                                @if($footerNote !== '')
                                    <p>{{ $footerNote }}</p>
                                @endif

                                @if($showClosing)
                                    <p class="closing-text" style="margin-top:20px">
                                        {{ $closingSection !== '' ? $closingSection : __('email.regards') }}
                                    </p>
                                    <p class="strong-text" style="margin:8px 0 0 0;font-weight:700">
                                        {{ __('email.teamSignature', ['appName' => config('app.name')]) }}
                                    </p>
                                @endif
                            </td>
                        </tr>
                        <tr>
                            <td class="mp mg footer-border footer-bg" style="padding:24px 40px 32px;border-top:1px solid #d5dce8;background-color:#f5f7fb;color:#8a94b0">
                                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                    <tr>
                                        <td class="footer-links" style="font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:20px;text-transform:uppercase;letter-spacing:0.06em">
                                            <a href="https://hibarr.de/privacy-policy" style="color:#8a94b0;text-decoration:none">Privacy</a>
                                            <span style="margin:0 5px;color:#8a94b0">|</span>
                                            <a href="mailto:support@hibarr.de" style="color:#8a94b0;text-decoration:none">Support</a>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td class="footer-copy" style="padding-top:8px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:20px;letter-spacing:0.02em">
                                            &copy; {{ date('Y') }} {{ config('app.name') }}. All rights reserved.
                                            @if($subfooter !== '')
                                                <br>{{ $subfooter }}
                                            @endif
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </div>
</div>
</body>
</html>
