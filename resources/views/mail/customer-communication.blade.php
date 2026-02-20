<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $subject ?? 'Customer Communication' }}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f6f6f6; font-family: Arial, sans-serif;">
    <table width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="#f6f6f6">
        <tr>
            <td align="center" style="padding: 20px 0;">
                <table width="600" border="0" cellpadding="0" cellspacing="0" style="width: 600px; max-width: 600px; background-color: #ffffff;">
                    <!-- Logo Section (same as base layout) -->
                    <tr>
                        <td align="center" bgcolor="#ffffff" style="padding: 20px 0; border-top: 5px solid {{ $themeColor ?? '#0056b3' }};">
                            <a href="{{ $websiteUrl ?? '#' }}" target="_blank" style="text-decoration: none;">
                                <!-- Light Mode Logo -->
                                <img src="{{ config('email.logo.light', 'https://res.cloudinary.com/hibarr/image/upload/v1747030452/hibarr-logo-blue_be6oer.png') }}"
                                     alt="{{ $companyName ?? config('app.name') }} Logo"
                                     class="light-logo"
                                     style="width:140px; height:auto; display:block; margin:0 auto;">
                                <!-- Dark Mode Logo -->
                                <img src="{{ config('email.logo.dark', 'https://res.cloudinary.com/hibarr/image/upload/v1752237736/logo_ywr5n3.png') }}"
                                     alt="{{ $companyName ?? config('app.name') }} Logo"
                                     class="dark-logo"
                                     style="width:140px; height:auto; display:none; margin:0 auto;">
                            </a>
                        </td>
                    </tr>
                    <tr>
                        <td bgcolor="#ffffff" style="padding: 20px 30px; color: #333333; font-size: 15px; line-height: 1.6;">
                            <p style="margin: 0 0 14px;">Dear {{ $customerName }},</p>
                            
                            @if (!empty($emailContent))
                            {{-- Email content is sanitized in the Mailable to prevent XSS attacks --}}
                            {{-- Only safe HTML tags are allowed (p, br, strong, em, a, etc.) --}}
                            <div style="margin: 0 0 15px;">
                                {!! $emailContent !!}
                            </div>
                            @endif
                            
                            @if (!empty($templateData))
                            @foreach($templateData as $key => $value)
                            @if(is_string($value))
                            <p style="margin: 0 0 15px;">
                                <strong>{{ ucfirst(str_replace('_', ' ', $key)) }}:</strong> {{ $value }}
                            </p>
                            @endif
                            @endforeach
                            @endif
                            
                            <p style="margin: 0 0 14px;">We look forward to hearing from you.</p>
                            <p style="margin: 0 0 20px;">Sincerely,</p>

                            {{-- Signature block: photo, name, designation, website, email, address, logo (blue #053160) --}}
                            <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 400px; margin: 0; font-family: Arial, sans-serif; background-color: #ffffff;">
                                <tbody>
                                    <tr>
                                        <td style="background-color: #ffffff">
                                            <table cellpadding="0" cellspacing="0" border="0" width="100%">
                                                <tbody>
                                                    <tr>
                                                        @if(isset($senderImageUrl) && $senderImageUrl !== '')
                                                        <td valign="middle" style="padding-right: 7px; vertical-align: middle">
                                                            <table cellpadding="0" cellspacing="0" border="0">
                                                                <tbody>
                                                                    <tr>
                                                                        <td style="width: 85px; height: 85px; background-color: {{ $themeColor ?? '#0056b3' }}; padding: 5px; padding-bottom: 5px;">
                                                                            <table cellpadding="0" cellspacing="0" border="0" width="75" height="75">
                                                                                <tbody>
                                                                                    <tr>
                                                                                        <td style="overflow: hidden;">
                                                                                                <img src="{{ $senderImageUrl }}" alt="" width="120" height="120" style="display: block; margin: 0 auto; height: 120px; width: 120px; object-fit: cover;">
                                                                                        </td>
                                                                                    </tr>
                                                                                </tbody>
                                                                            </table>
                                                                        </td>
                                                                    </tr>
                                                                </tbody>
                                                            </table>
                                                        </td>
                                                        @endif
                                                        <td valign="middle" style="vertical-align: middle; padding-right: 10px; min-width: 190px; max-width: 230px; width: 230px; {{ (isset($senderImageUrl) && $senderImageUrl !== '') ? '' : 'max-width: 190px; width: 190px;' }}">
                                                            <table cellpadding="0" cellspacing="0" border="0" width="100%">
                                                                <tbody>
                                                                    <tr>
                                                                        <td style="padding-bottom: 2px; font-size: 14px; font-weight: bold; color:{{ $themeColor ?? '#0056b3' }}; letter-spacing: 0.3px; line-height: 1.2;">
                                                                            {{ $senderName }}
                                                                        </td>
                                                                    </tr>
                                                                    @if(!empty($senderJobTitle))
                                                                    <tr>
                                                                        <td style="padding-bottom: 5px; font-size: 11px; font-weight: 300; color:{{ $themeColor ?? '#0056b3' }}; line-height: 1.3; opacity: 0.9;">
                                                                            {{ $senderJobTitle }}
                                                                        </td>
                                                                    </tr>
                                                                    @endif
                                                                    <tr>
                                                                        <td>
                                                                            <table cellpadding="0" cellspacing="0" border="0">
                                                                                <tbody>
                                                                                    @if(!empty($websiteUrl))
                                                                                    <tr>
                                                                                        <td style="padding-bottom: 4px">
                                                                                            <table cellpadding="0" cellspacing="0" border="0">
                                                                                                <tbody>
                                                                                                    <tr>
                                                                                                        <td >
                                                                                                            <div style="width: 18px; height: 18px; min-width: 18px; max-width: 18px; min-height: 18px; max-height: 18px; text-align: center; vertical-align: middle; background-color:{{ $themeColor ?? '#0056b3' }}; overflow: hidden; border-radius: 3px; padding: 2px; display: flex; align-items: center; justify-content: center;">
                                                                                                            <img style="display: block; margin: 0 auto; height: 14px; width: 14px;" height="14" width="14" src="https://res.cloudinary.com/hibarr/image/upload/v1770820008/internetIcon_htrioq.png" alt="">
                                                                                                            </div>
                                                                                                        </td>
                                                                                                        <td style="padding-left: 7px; font-size: 11px; color:{{ $themeColor ?? '#0056b3' }}; vertical-align: middle;">
                                                                                                            <a href="{{ $websiteUrl }}" target="_blank" style="color:{{ $themeColor ?? '#0056b3' }}; text-decoration: none;">{{ parse_url($websiteUrl, PHP_URL_HOST) ?: $companyName }}</a>
                                                                                                        </td>
                                                                                                    </tr>
                                                                                                </tbody>
                                                                                            </table>
                                                                                        </td>
                                                                                    </tr>
                                                                                    @endif
                                                                                    <tr>
                                                                                        <td style="padding-bottom: 4px">
                                                                                            <table cellpadding="0" cellspacing="0" border="0">
                                                                                                <tbody>
                                                                                                    <tr>
                                                                                                        <td >
                                                                                                            <div style="width: 18px; height: 18px; min-width: 18px; max-width: 18px; min-height: 18px; max-height: 18px; text-align: center; vertical-align: middle; background-color:{{ $themeColor ?? '#0056b3' }}; overflow: hidden; border-radius: 3px; padding: 2px; display: flex; align-items: center; justify-content: center;">
                                                                                                                <img style="display: block; margin: 0 auto; height: 14px; width: 14px;" height="14" width="14" src="https://res.cloudinary.com/hibarr/image/upload/v1770820008/envelopIcon_dgvbt4.png" alt="">
                                                                                                            </div>
                                                                                                        </td>
                                                                                                        <td style="padding-left: 7px; font-size: 11px; color:{{ $themeColor ?? '#0056b3' }}; vertical-align: middle;">
                                                                                                            <a href="mailto:{{ $senderEmail }}" target="_blank" style="color:{{ $themeColor ?? '#0056b3' }}; text-decoration: none;">{{ $senderEmail }}</a>
                                                                                                        </td>
                                                                                                    </tr>
                                                                                                </tbody>
                                                                                            </table>
                                                                                        </td>
                                                                                    </tr>
                                                                                    @if(isset($companyAddress) && $companyAddress !== '')
                                                                                    <tr>
                                                                                        <td>
                                                                                            <table cellpadding="0" cellspacing="0" border="0">
                                                                                                <tbody>
                                                                                                    <tr>
                                                                                                        <td>
                                                                                                            <div style="width: 18px; height: 18px; min-width: 18px; max-width: 18px; min-height: 18px; max-height: 18px; text-align: center; vertical-align: middle; background-color:{{ $themeColor ?? '#0056b3' }}; overflow: hidden; border-radius: 3px; padding: 2px; display: flex; align-items: center; justify-content: center;">
                                                                                                            <img style="display: block; margin: 0 auto; height: 14px; width: 14px;" height="14" width="14" src="https://res.cloudinary.com/hibarr/image/upload/v1770820007/locationPin_indgjq.png" alt="">
                                                                                                            </div>
                                                                                                        </td>
                                                                                                        <td style="padding-left: 9px; font-size: 11px; color: {{ $themeColor ?? '#0056b3' }}; vertical-align: top; line-height: 1.3;">
                                                                                                            {!! nl2br(e($companyAddress)) !!}
                                                                                                        </td>
                                                                                                    </tr>
                                                                                                </tbody>
                                                                                            </table>
                                                                                        </td>
                                                                                    </tr>
                                                                                    @endif
                                                                                </tbody>
                                                                            </table>
                                                                        </td>
                                                                    </tr>
                                                                </tbody>
                                                            </table>
                                                        </td>
                                                        <td width="0.5" valign="middle" style="width: 0.5px; vertical-align: middle; padding: 0 0.5px; {{ (isset($senderImageUrl) && $senderImageUrl !== '') ? '' : 'padding:0.0px 0.1px;' }}">
                                                            <div style="width: 100%; min-width: 1px; height: {{ (isset($senderImageUrl) && $senderImageUrl !== '') ? '130px' : '95px' }}; max-height: 80%; background-color: {{ $themeColor ?? '#0056b3' }}; margin: 0 auto;"></div>
                                                        </td>
                                                        <td width="80" valign="middle" style="width: 80px; vertical-align: middle; padding-left: 10px">
                                                            
                                                            <table cellpadding="0" cellspacing="0" border="0" width="80" height="80">
                                                                <tbody>
                                                                    <tr>
                                                                        <td style="width: 80px;
                                              height: 80px;
                                              background-color: #ffffff;
                                              vertical-align: middle;
                                              text-align: center;
                                              padding: 4px;
                                              margin: 0 auto;">
                                                                            <img style="display: block" height="90" width="90" src="https://res.cloudinary.com/hibarr/image/upload/v1752237705/logomark_tbjaw0.png">
                                                                        </td>
                                                                    </tr>
                                                                </tbody>
                                                            </table>
                                                      
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
