{{--
  Hibarr branded Lead reminder — SMTP / UNS body fallback.
  Keep in sync with resources/views/mail/lead/lead-reminder.plunk.html
--}}
<div style="font-size:10pt;font-family:Verdana,Arial,Helvetica,sans-serif">
<style>
.hm,.hm table,.hm td,.hm p,.hm a{-ms-text-size-adjust:100%;-webkit-text-size-adjust:100%}
.hm table{border-collapse:collapse}
.hm img{border:0;height:auto;line-height:100%;outline:none;text-decoration:none;display:block}
.hm .content p{margin:0 0 16px;font-family:"Syne",Georgia,serif;font-size:14px;line-height:22px;color:#0a0e1a}
.hm .content p:last-child{margin-bottom:0}
.hm .content a{color:#003160;text-decoration:underline;font-family:"DM Mono","Consolas",monospace;font-size:14px;line-height:22px}
@media only screen and (max-width:620px){
.hm .shell{width:100%!important}
.hm .mp{padding-left:20px!important;padding-right:20px!important}
.hm .mg{padding-top:24px!important;padding-bottom:24px!important}
.hm .footer-links a,.hm .footer-copy{font-size:12px!important;line-height:18px!important}
}
</style>
<div class="hm" style="margin:0;padding:0;width:100%">
<div style="display:none;font-size:1px;color:#eef2f8;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">{{ $preheader }}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#eef2f8">
<tr>
<td align="center" style="padding:32px 12px">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" align="center" class="shell" style="width:600px;max-width:600px;background-color:#ffffff;border:1px solid #d5dce8">
<tr>
<td style="height:3px;background-color:#003160;font-size:0;line-height:0">&nbsp;</td>
</tr>
<tr>
<td class="mp mg" style="padding:32px 40px 24px;border-bottom:1px solid #d5dce8">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
<tr>
<td align="left">
<img src="https://res.cloudinary.com/hibarr/image/upload/v1753433790/hibarr-logo-full-blue_f5xqb0.png" alt="HIBARR" width="140" height="36" style="display:block;width:140px;height:auto" />
</td>
</tr>
<tr>
<td style="padding-top:16px;font-family:'DM Mono',monospace;font-size:11px;line-height:16px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#003160">
<span style="display:inline-block;width:18px;height:2px;background-color:#003160;vertical-align:middle;margin-right:10px"></span>Lead Reminder
</td>
</tr>
</table>
</td>
</tr>
<tr>
<td class="content mp" style="padding:32px 40px 40px">
<p>{{ $leadMessage }}</p>

<div style="border-top:1px solid #d5dce8;margin:20px 0 0;padding:20px 0 0">
<div style="font-family:Syne,Georgia,serif;font-size:20px;font-weight:700;color:#0a0e1a;line-height:1.2;margin-bottom:8px">
{{ $eventDate }}@if($eventTime)&ensp;&middot;&ensp;{{ $eventTime }}@endif
</div>
<div style="font-family:'DM Mono',Consolas,monospace;font-size:14px;color:#4a5272;line-height:1.6;margin-bottom:4px">{{ $leadTitle }}</div>
</div>

<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0 24px">
<tr>
<td bgcolor="#003160">
<a href="{{ $url }}" style="display:inline-block;background-color:#003160;color:#ffffff;font-family:'DM Mono',Consolas,monospace;font-size:12px;font-weight:700;letter-spacing:0.10em;text-decoration:none;padding:13px 28px;text-transform:uppercase">{{ $actionText }} &rarr;</a>
</td>
</tr>
</table>
<p>Review this lead and take the appropriate next steps.</p>
</td>
</tr>
<tr>
<td class="mp mg" style="padding:24px 40px 32px;border-top:1px solid #d5dce8;background-color:#f5f7fb;color:#8a94b0">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
<tr>
<td class="footer-links" style="font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:20px;text-transform:uppercase;letter-spacing:0.06em">
<a href="https://hibarr.de/privacy-policy" style="color:#8a94b0;text-decoration:none">Privacy</a>
<span style="margin:0 5px;color:#8a94b0">|</span>
<a href="mailto:support@hibarr.de" style="color:#8a94b0;text-decoration:none">Support</a>
</td>
</tr>
<tr>
<td class="footer-copy" style="padding-top:8px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:20px;letter-spacing:0.02em">&copy; {{ date('Y') }} HIBARR. All rights reserved.</td>
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
