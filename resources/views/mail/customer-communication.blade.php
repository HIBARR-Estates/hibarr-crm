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
                    <tr>
                        <td align="center" bgcolor="#f8f8f8" style="padding: 20px 0; border-top: 5px solid {{ $themeColor ?? '#0056b3' }};">
                            @if(!empty($logoUrl))
                            <a href="{{ $websiteUrl ?? '#' }}" target="_blank" style="text-decoration: none;">
                                <img src="{{ $logoUrl }}" 
                                     alt="{{ $companyName ?? config('app.name') }} Logo" 
                                     width="150" 
                                     height="auto" 
                                     style="display: block; border: 0;">
                            </a>
                            @endif
                        </td>
                    </tr>
                    <tr>
                        <td bgcolor="#ffffff" style="padding: 40px 30px; color: #333333; font-size: 15px; line-height: 1.6;">
                            <p style="margin: 0 0 14px;">Dear {{ $customerName }},</p>
                            
                            @if (!empty($emailContent))
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
                            <p style="margin: 0;">Sincerely,</p>
                        </td>
                    </tr>
                    <tr>
                        <td bgcolor="#ffffff" style="padding: 0 30px 40px 30px; font-size: 13px; color: #777777;">
                            <div style="border-top: 1px solid #dddddd; margin-bottom: 15px;"></div>
                            
                            <p style="margin: 0; color: #333333; font-size: 15px; font-weight: bold;">
                                {{ $senderName }}
                            </p>
                            @if(!empty($senderJobTitle))
                            <p style="margin: 5px 0 10px 0;">
                                {{ $senderJobTitle }} | {{ $companyName ?? config('app.name') }}
                            </p>
                            @else
                            <p style="margin: 5px 0 10px 0;">
                                {{ $companyName ?? config('app.name') }}
                            </p>
                            @endif
                            @if(!empty($senderPhone))
                            <p style="margin: 0;">
                                <strong>Phone:</strong> <a href="tel:{{ $senderPhone }}" style="color: {{ $themeColor ?? '#0056b3' }}; text-decoration: none;">{{ $senderPhone }}</a>
                            </p>
                            @endif
                            <p style="margin: 0;">
                                <strong>Email:</strong> <a href="mailto:{{ $senderEmail }}" style="color: {{ $themeColor ?? '#0056b3' }}; text-decoration: none;">{{ $senderEmail }}</a>
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
