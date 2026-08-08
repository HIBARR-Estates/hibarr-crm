{{--
  Inbox preview text (preheader). Pass $preheader explicitly, or fall back via $fallback.
  Keep styling in sync with Hibarr reminder templates.
--}}
@php
    $resolvedPreheader = trim((string) ($preheader ?? ''));
    if ($resolvedPreheader === '' && isset($fallback)) {
        $resolvedPreheader = trim((string) $fallback);
    }
    if ($resolvedPreheader !== '') {
        $resolvedPreheader = html_entity_decode(
            strip_tags(str_replace(['<br>', '<br/>', '<br />', '</p>', '</div>'], ' ', $resolvedPreheader)),
            ENT_QUOTES,
            'UTF-8'
        );
        $resolvedPreheader = preg_replace('/^#+\s*/m', '', $resolvedPreheader) ?? $resolvedPreheader;
        $resolvedPreheader = trim(preg_replace('/\s+/u', ' ', $resolvedPreheader) ?? $resolvedPreheader);
        $resolvedPreheader = \Illuminate\Support\Str::limit($resolvedPreheader, 140);
    }
@endphp
@if($resolvedPreheader !== '')
<div style="display:none;font-size:1px;color:#eef2f8;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">{{ $resolvedPreheader }}@for($i = 0; $i < 40; $i)&nbsp;&zwnj;@endfor</div>
@endif
