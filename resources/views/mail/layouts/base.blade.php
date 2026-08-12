<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="color-scheme" content="light dark">
    <meta name="supported-color-schemes" content="light dark">
    <title>@yield('title') - {{ config('app.name') }}</title>
    <style>
        :root { color-scheme: light dark; supported-color-schemes: light dark; }
        
        /* Logo Display Logic */
        .dark-logo { display: none !important; }
        .light-logo { display: block !important; }

        /* Dark Mode Styles */
        @media (prefers-color-scheme: dark) {
            body, .main-container { background: #0a0a0a !important; }
            .email-card { background: #1a1a1a !important; border-color: #333333 !important; }
            .logo-section { border-bottom-color: #333333 !important; }
            .greeting-text, .closing-text, .strong-text { color: #ffffff !important; }
            .body-text { color: #e5e7eb !important; }
            .notification-box { background: #1e3a8a !important; border-color: #3b82f6 !important; }
            .notification-text { color: #93c5fd !important; }
            .button-bg { background: #2563eb !important; }
            .button-text { color: #ffffff !important; }
            .footer-text { color: #6b7280 !important; }
            .subfooter-text { color: #4b5563 !important; }
            
            /* Swap Logos for Dark Mode */
            .dark-logo { display: block !important; }
            .light-logo { display: none !important; }
        }

        /* Mobile Responsive */
        @media only screen and (max-width: 600px) {
            .main-container { padding: 10px !important; }
            .email-card { width: 100% !important; border-radius: 0 !important; }
            .logo-section, .content-section, .footer-section { padding: 30px 20px !important; }
            .notification-box { padding: 15px !important; }
            .button-wrapper { padding: 15px 20px 0 20px !important; }
        }
    </style>
</head>
<body style="margin:0; padding:0; background:#f5f5f5; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
    @php
        $layoutPreheader = is_string($preheader ?? null) ? $preheader : '';
        // Cap before trim/yield — huge strings OOM during preheader sanitize.
        if ($layoutPreheader !== '' && strlen($layoutPreheader) > 500) {
            $layoutPreheader = substr($layoutPreheader, 0, 500);
        }
        $layoutPreheader = trim($layoutPreheader);
        // Prefer the explicit preheader; do not materialize huge @section yields
        // just to invent a preview string (yieldContent copies the full section).
        if ($layoutPreheader === '') {
            $layoutPreheader = 'Just a quick heads up';
        }
    @endphp
    @include('mail.partials.preheader', ['preheader' => $layoutPreheader])

    <!-- Wrapper Table -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" class="main-container" style="background:#f5f5f5; padding:20px 0;">
        <tr>
            <td align="center">
                
                <!-- Main Email Card -->
                <table width="600" cellpadding="0" cellspacing="0" border="0" role="presentation" class="email-card" style="max-width:600px; width:100%; background:#ffffff; border-radius:8px; overflow:hidden;">
                    
                    <!-- Logo Section -->
                    <tr>
                        <td class="logo-section" align="center" style="padding:40px 40px 35px 40px; border-bottom:1px solid #e8e8e8;">
                            <!-- Light Mode Logo -->
                            <img src="{{ config('email.logo.light', 'https://res.cloudinary.com/hibarr/image/upload/v1747030452/hibarr-logo-blue_be6oer.png') }}" 
                                 alt="{{ config('app.name') }} Logo" 
                                 class="light-logo" 
                                 style="width:140px; height:auto; display:block; margin:0 auto;">
                            
                            <!-- Dark Mode Logo -->
                            <img src="{{ config('email.logo.dark', 'https://res.cloudinary.com/hibarr/image/upload/v1752237736/logo_ywr5n3.png') }}" 
                                 alt="{{ config('app.name') }} Logo" 
                                 class="dark-logo" 
                                 style="width:140px; height:auto; display:none; margin:0 auto;">
                        </td>
                    </tr>
                    
                    <!-- Content Section -->
                    <tr>
                        <td class="content-section" style="padding:35px 40px 40px 40px;">
                            
                            <!-- Greeting -->
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
                                <tr>
                                    <td style="padding:0 0 10px 0;">
                                        <p class="greeting-text" style="margin:0; font-size:16px; color:#1a1a1a; line-height:1.6;">
                                            @lang('email.hello')@if(!empty($notifiableName)) <strong>{{ $notifiableName }}</strong>@endif,                                      </p>
                                    </td>
                                </tr>
                            </table>

                            <!-- Intro Text -->
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
                                <tr>
                                    <td style="padding:0 0 25px 0;">
                                        <p class="body-text" style="margin:0; font-size:15px; color:#333; line-height:1.7;">
                                            @yield('intro', 'Just a quick heads up')
                                        </p>
                                    </td>
                                </tr>
                            </table>

                             <!-- Notification Box -->
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
                                <tr>
                                    <td class="notification-box" style="background:#f0f9ff; border-left:4px solid #3b82f6; padding:20px; border-radius:6px;">
                                        <p class="notification-text" style="margin:0; font-size:15px; color:#1e40af; line-height:1.6;">
                                            @yield('content')
                                        </p>
                                    </td>
                                </tr>
                            </table>
                            
                            @php
                                $actionText = trim((string) $__env->yieldContent('actionText'));
                                $actionUrl = trim((string) $__env->yieldContent('actionUrl'));
                                $actionDescription = trim((string) $__env->yieldContent('actionDescription'));
                            @endphp

                            @if($actionText !== '' && $actionUrl !== '')
                                <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
                                    <tr>
                                        <td style="padding:25px 0 0 0;">
                                            <p class="body-text" style="margin:0; font-size:15px; color:#333; line-height:1.7;">
                                                {{ $actionDescription !== '' ? $actionDescription : 'Click the button below to proceed.' }}
                                            </p>
                                        </td>
                                    </tr>
                                </table>

                                <!-- Action Button -->
                                <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
                                    <tr>
                                        <td class="button-wrapper" style="padding:20px 0 0 0;">
                                            <table cellpadding="0" cellspacing="0" border="0" role="presentation">
                                                <tr>
                                                    <td class="button-bg" style="border-radius:6px; background:#3b82f6;">
                                                        <a href="{{ $actionUrl }}" target="_blank" rel="noopener" aria-label="{{ $actionText }}" class="button-text" style="display:inline-block; padding:12px 24px; font-size:15px; color:#ffffff; text-decoration:none; font-weight:600; border-radius:6px;">
                                                            {{ $actionText }}
                                                        </a>
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>
                                </table>
                            @endif
                            
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
                                <tr>
                                    <td style="padding:35px 0 0 0;">
                                        <p class="closing-text" style="margin:0; font-size:15px; color:#333; line-height:1.6;">
                                            Best regards
                                        </p>
                                        <p class="strong-text" style="margin:8px 0 0 0; font-size:15px; color:#1a1a1a; font-weight:600;">
                                            The {{config('app.name')}} Team
                                        </p>
                                    </td>
                                </tr>
                            </table>
                            
                        </td>
                    </tr>
                    
                    <!-- Footer Section -->
                    <tr>
                        <td class="footer-section" style="padding:40px 40px 40px 40px; border-top:1px solid #e8e8e8;">
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
                                <tr>
                                    <td align="center">
                                        <p class="footer-text" style="margin:0; font-size:13px; color:#6b7280; line-height:1.6;">
                                           &copy; {{date('Y')}} {{config('app.name')}}. All rights reserved.
                                        </p>
                                        <p class="subfooter-text" style="margin:12px 0 0 0; font-size:12px; color:#9ca3af; line-height:1.6;">
                                            @yield('subfooter', '')
                                        </p>
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