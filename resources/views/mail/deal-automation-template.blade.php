@php
    // Whether to render the body exactly as-is vs. wrap it in the generic
    // shell/card below. Deliberately NOT content-sniffed (a stray <table> or
    // <style> tag inside otherwise-simple content used to trip a "looks like
    // a full design" heuristic and dump the whole body unstyled/unbounded)
    // — matching how transactional ESPs (Postmark, Resend, Mailgun) decide
    // this: one unambiguous signal, "did the author provide a complete
    // document." Paste a full <html>...</html> body to take over 100% of the
    // design, including the outer shell below; anything else (plain
    // paragraphs/lists, or a fragment that merely contains a table/style tag
    // without being a full document) gets the safe default layout.
    $bodyIsCompleteDocument = \App\Models\EmailTemplate::bodyIsCompleteHtmlDocument($bodyHtml ?? '');
@endphp
@if($bodyIsCompleteDocument)
{!! $bodyHtml !!}
@else
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
    {{-- $isPreview is only ever passed by EmailTemplateController@preview — never by
         DealAutomationTemplateEmail — so this banner can never leak into a real send. --}}
    @if(!empty($isPreview) && ($templateMode ?? null) === 'plunk_body')
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
</body>
</html>
@endif
