<!doctype html>
<html lang="en">

<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="color-scheme" content="light dark">
    <meta name="supported-color-schemes" content="light dark">
    <title>Account Created Successfully - {{ config('app.name') }}</title>
    <style>
        :root {
            color-scheme: light dark;
            supported-color-schemes: light dark;
        }

        .dark-logo {
            display: none !important;
        }

        .light-logo {
            display: block !important;
        }

        @media (prefers-color-scheme: dark) {
            body {
                background: #1a1a1a !important;
            }

            .main-container {
                background: #1a1a1a !important;
            }

            .email-card {
                background: #262626 !important;
            }

            .header-td {
                border-bottom-color: #404040 !important;
            }

            .content-card {
                background: #333333 !important;
                border-color: #404040 !important;
            }

            .heading {
                color: #ffffff !important;
            }

            .text-paragraph {
                color: #e5e7eb !important;
            }

            .credentials-box {
                background: #262626 !important;
                border-color: #404040 !important;
            }

            .label-text {
                color: #9ca3af !important;
            }

            .value-text {
                color: #ffffff !important;
            }

            .dark-logo {
                display: block !important;
            }

            .light-logo {
                display: none !important;
            }
        }

        @media only screen and (max-width: 600px) {
            .main-container {
                padding: 5px !important;
            }

            .email-card {
                width: 100% !important;
            }

            .header-td {
                padding: 13px !important;
            }

            .body-td {
                padding: 13px !important;
            }

            .content-card {
                padding: 13px !important;
            }
        }
    </style>
</head>

<body
    style="margin:0; padding:0; background:#f5f5f5; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
    @include('mail.partials.preheader', [
        'preheader' => $preheader ?? ($content ?? __('email.invitation.subject') . config('app.name')),
    ])

    <!-- Main Container -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" class="main-container"
        style="background:#f5f5f5; padding:40px 20px;">
        <tr>
            <td align="center">

                <!-- Email Card -->
                <table width="640" cellpadding="0" cellspacing="0" border="0" role="presentation" class="email-card"
                    style="max-width:640px; width:100%; background:#ffffff; border-radius:8px; overflow:hidden;">

                    <!-- Header with Logo -->
                    <tr>
                        <td role="banner" aria-label="Email header" class="header-td"
                            style="padding:24px 40px; border-bottom:1px solid #e5e7eb;">
                            <table cellpadding="0" cellspacing="0" border="0" role="presentation">
                                <tr>
                                    <td style="vertical-align:middle; padding-right:12px;">
                                        <div role="img" aria-label="{{ config('app.name') }} company logo">
                                            <img src="{{ config('email.logo.light', 'https://res.cloudinary.com/hibarr/image/upload/v1747030452/hibarr-logo-blue_be6oer.png') }}"
                                                alt="{{ config('app.name') }} Logo" class="light-logo" style="width: 120px; height:auto; display:block;">
                                            <img src="{{ config('email.logo.dark', 'https://res.cloudinary.com/hibarr/image/upload/v1752237736/logo_ywr5n3.png') }}"
                                                alt="{{ config('app.name') }} Logo" class="dark-logo"
                                                style="width: 120px; height:auto; display:none;">
                                        </div>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Body Content -->
                    <tr>
                        <td role="main" aria-label="Main email content" class="body-td" style="padding:48px 40px;">

                            <!-- Content Card -->
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"
                                class="content-card"
                                style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:12px; padding:40px;">
                                <tr>
                                    <td>

                                        <!-- Greeting -->
                                        <h2 class="heading"
                                            style="margin:0 0 24px 0; font-size:22px; font-weight:600; color:#1a1a1a; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                                            @lang('email.hello')@if(!empty($notifiableName)){{ ' '.$notifiableName }}@endif!</h2>

                                        <!-- Message -->
                                        <p class="text-paragraph"
                                            style="margin:0 0 32px 0; font-size:16px; line-height:24px; color:#4b5563; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                                            {!! $content !!}
                                        </p>

                                        <!-- Buttons -->
                                        <table cellpadding="0" cellspacing="0" border="0" role="presentation">
                                            <tr>
                                                <td style="padding-right:12px;">
                                                    <a href="{{ $url }}" aria-label="{{ $actionText }}"
                                                        style="display:inline-block; padding:12px 24px; background:#2563eb; color:#ffffff; text-decoration:none; border-radius:8px; font-size:15px; font-weight:600; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;"
                                                        target="_blank" rel="noopener">{{ $actionText }}</a>
                                                </td>

                                            </tr>
                                        </table>

                                    </td>
                                </tr>
                            </table>

                        </td>
                    </tr>

                </table>

            </td>
        </tr>
    </table>

</body>

</html>
