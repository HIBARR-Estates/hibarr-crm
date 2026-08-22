<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    {{-- Never rendered inline, but a huge one is still wasteful/messy — cap the
         strip_tags() fallback instead of dumping the whole (possibly multi-KB)
         body in, and prefer the real subject when the caller has one. --}}
    <title>{{ !empty($subject) ? $subject : ($bodyHtml ? \Illuminate\Support\Str::limit(trim(preg_replace('/\s+/', ' ', strip_tags($bodyHtml))), 80) : config('app.name')) }}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f6f6f6; font-family: Arial, sans-serif;">
    @include('mail.partials.preheader', ['preheader' => $preheader ?? null])
    @php
        $bodyLooksLikeFullHtml = \App\Models\EmailTemplate::bodyLooksLikeFullHtml($bodyHtml ?? '');
    @endphp
    {{-- $isPreview is only ever passed by EmailTemplateController@preview — never by
         DealAutomationTemplateEmail — so this banner can never leak into a real send.
         Only relevant when we're actually using the generic wrapper below — a
         self-contained HTML body skips it, so there's no "generic wrapper" to warn about. --}}
    @if(!empty($isPreview) && ($templateMode ?? null) === 'plunk_body' && !$bodyLooksLikeFullHtml)
        <table width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="#f6f6f6">
            <tr>
                <td align="center" style="padding: 10px 0 0;">
                    <table width="600" border="0" cellpadding="0" cellspacing="0" style="width: 600px; max-width: 600px;">
                        <tr>
                            <td style="background:#fff3cd; border:1px solid #ffe69c; border-radius:4px; padding:10px 16px; font-size:12px; color:#664d03;">
                                Preview only: this shows your Body content in a generic wrapper. The real email is injected into your Plunk base template's own design instead of this wrapper.
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    @endif
    {{-- A body that already brings its own <table>-based layout/<style> block
         (a fully custom-designed email, e.g. pasted from an external tool)
         is used as-is — wrapping it in another 600px/padded card would
         double-box a design that's already complete. Simple Quill-authored
         bodies (the common case: paragraphs, lists, a link or two) still get
         the generic centered card so they don't render as unstyled raw text. --}}
    @if($bodyLooksLikeFullHtml)
        {!! $bodyHtml !!}
    @else
        <table width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="#f6f6f6">
            <tr>
                <td align="center" style="padding: 20px 0;">
                    <table width="600" border="0" cellpadding="0" cellspacing="0" style="width: 600px; max-width: 600px; background-color: #ffffff;">
                        <tr>
                            <td style="padding: 30px; color: #333333; font-size: 14px; line-height: 1.6;">
                                {!! $bodyHtml !!}
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    @endif
</body>
</html>
