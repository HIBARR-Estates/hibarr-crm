<!doctype html>
<html lang="en">

<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="color-scheme" content="light dark">
    <meta name="supported-color-schemes" content="light dark">
    <title>Event Reminder - {{ config('app.name') }}</title>
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

            .heading-primary {
                color: #ffffff !important;
            }

            .text-secondary {
                color: #9ca3af !important;
            }

            .text-primary {
                color: #ffffff !important;
            }

            .meeting-link-box {
                background: #262626 !important;
                border-color: #404040 !important;
            }

            .link-subtext {
                color: #9ca3af !important;
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
        }
    </style>
</head>

<body
    style="margin:0; padding:0; background:#f5f5f5; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
    @include('mail.partials.preheader', [
        'preheader' => $preheader ?? ($content ?? __('email.newEvent.text')),
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
                        <td role="main" aria-label="Main email content" style="padding:0;">

                            <!-- Header Image from User Snippet -->
                            <img src="https://img.zohocdn.com/calendar/email-template-assets/calendar-header-doodle-v1.png"
                                width="100%" height="36" alt=""
                                style="display:block; max-height:36px; object-fit: cover;">

                            <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"
                                style="padding:32px 40px;">
                                <tr>
                                    <td class="body-td">
                                        <!-- Heading -->
                                        <h1 class="heading-primary"
                                            style="margin:0 0 24px 0; font-size:24px; font-weight:500; color:#111827; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                                            New event reminder</h1>

                                        <!-- Subtitle -->
                                        <p class="text-secondary"
                                            style="margin:0 0 32px 0; font-size:15px; color:#6b7280; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                                            You have set a reminder for <strong>{{ $eventName }}</strong>
                                        </p>

                                        <!-- Event Details -->
                                        <table width="100%" cellpadding="0" cellspacing="0" border="0"
                                            style="margin-bottom:32px;">

                                            <!-- Event Title Row -->
                                            <tr>
                                                <td style="padding-bottom:20px;">
                                                    <table cellpadding="0" cellspacing="0" border="0">
                                                        <tr>
                                                            <td
                                                                style="padding-right:12px; vertical-align:top; padding-top:2px;">
                                                                <img src="https://img.zohocdn.com/calendar/email-template-assets/icon-title-v1.png"
                                                                    width="12" height="12" alt=""
                                                                    style="display:block;">
                                                            </td>
                                                            <td style="vertical-align:top;">
                                                                <div class="text-secondary"
                                                                    style="font-size:14px; color:#9ca3af; margin-bottom:4px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                                                                    Event title</div>
                                                                <div class="text-primary"
                                                                    style="font-size:16px; color:#111827; font-weight:400; line-height:1.5; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                                                                    {{ $eventName }}</div>
                                                            </td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>

                                            <!-- Date and Time Row -->
                                            <tr>
                                                <td>
                                                    <table cellpadding="0" cellspacing="0" border="0">
                                                        <tr>
                                                            <td
                                                                style="padding-right:12px; vertical-align:top; padding-top:2px;">
                                                                <img src="https://img.zohocdn.com/calendar/email-template-assets/icon-time-v1.png"
                                                                    width="14" height="14" alt=""
                                                                    style="display:block;">
                                                            </td>
                                                            <td style="vertical-align:top;">
                                                                <div class="text-secondary"
                                                                    style="font-size:14px; color:#9ca3af; margin-bottom:4px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                                                                    Date and time</div>
                                                                <div class="text-primary"
                                                                    style="font-size:16px; color:#111827; font-weight:400; line-height:1.5; margin-bottom:4px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                                                                    {{ $dateTime }}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>

                                        </table>

                                        <!-- Virtual Conferencing Link (Optional - only show if meeting link exists) -->
                                        @if(!empty($meetingLink))
                                        <table width="100%" cellpadding="0" cellspacing="0" border="0"
                                            style="margin-bottom:24px;">

                                            <!-- Conference Icon and Label -->
                                            <tr>
                                                <td style="padding-bottom:10px;">
                                                    <table cellpadding="0" cellspacing="0" border="0">
                                                        <tr>
                                                            <td
                                                                style="padding-right:12px; vertical-align:top; padding-top:2px;">
                                                                <img src="https://img.zohocdn.com/calendar/email-template-assets/icon-conference-v1.png"
                                                                    width="12" height="12" alt=""
                                                                    style="display:block;">
                                                            </td>
                                                            <td style="vertical-align:top;">
                                                                <div class="text-secondary"
                                                                    style="font-size:14px; color:#9ca3af; margin-bottom:4px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                                                                    Virtual Meeting Link</div>
                                                            </td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>

                                            <!-- Meeting Details Card -->
                                            <tr>
                                                <td>
                                                    <table cellpadding="0" cellspacing="0" border="0" width="100%"
                                                        class="meeting-link-box"
                                                        style="border:1px solid #e5e7eb; border-radius:6px; background:#ffffff;">
                                                        <tr>
                                                            <td style="padding:12px 16px;">
                                                                <div class="text-primary"
                                                                    style="color:#111827; margin-bottom:8px; font-weight:500; font-size:14px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                                                                    Meeting Link</div>
                                                                <a href="{{ $meetingLink }}"
                                                                    class="link-subtext"
                                                                    style="color:#6b7280; font-size:13px; text-decoration:none; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif; display:block; word-break:break-all;"
                                                                    target="_blank">{{ $meetingLink }}</a>
                                                            </td>
                                                            <td
                                                                style="width:80px; text-align:right; padding:12px 16px;">
                                                                <a href="{{ $meetingLink }}"
                                                                    style="background:#2563eb; color:#ffffff !important; padding:8px 16px; border-radius:4px; text-decoration:none; display:inline-block; font-size:14px; font-weight:500; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;"
                                                                    target="_blank">Join</a>
                                                            </td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>

                                        </table>
                                        @endif

                                        <!-- Buttons -->
                                        <table cellpadding="0" cellspacing="0" border="0">
                                            <tr>
                                                <td style="padding-right:12px;">
                                                    <a href="{{ $viewEventUrl }}" target="_blank" rel="noopener"
                                                        style="display:inline-block; padding:12px 24px; border-radius:8px; background:#2563eb; color:#ffffff; text-decoration:none; font-weight:600; font-size:15px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">View
                                                        Event</a>
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
