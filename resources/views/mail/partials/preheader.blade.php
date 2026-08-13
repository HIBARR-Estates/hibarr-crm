{{--
  Inbox preview text (preheader). Pass $preheader explicitly, or fall back via $fallback.
  Keep styling in sync with Hibarr reminder templates.

  Cap length BEFORE trim/strip_tags/preg_replace — those copy the full string and will
  OOM if a caller passes a huge HTML body (or corrupted field) as the preheader.
--}}
@php
    $resolvedPreheader = is_string($preheader ?? null) ? $preheader : (string) ($preheader ?? '');
    if ($resolvedPreheader === '' && isset($fallback)) {
        $resolvedPreheader = is_string($fallback) ? $fallback : (string) $fallback;
    }
    // Hard cap FIRST so later sanitization cannot allocate unbounded memory.
    if ($resolvedPreheader !== '' && strlen($resolvedPreheader) > 2000) {
        $resolvedPreheader = substr($resolvedPreheader, 0, 2000);
    }
    $resolvedPreheader = trim($resolvedPreheader);
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
<div style="display:none;font-size:1px;color:#eef2f8;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">{{ $resolvedPreheader }}@for($i = 0; $i < 40; $i++)&nbsp;&zwnj;@endfor</div>
@endif
