{{--
  Brevo-style inbox preheader (preview text hack).

  Place as the FIRST child inside the email body wrapper — before logo/tables.
  Pass $preheader (or $fallback). Keep copy short and complementary to subject.

  Cap length BEFORE sanitize — unbounded strings OOM during strip_tags/preg.
--}}
@php
    $resolvedPreheader = \App\Support\MailPreheader::sanitize(
        is_string($preheader ?? null) ? $preheader : (
            (isset($fallback) && is_string($fallback)) ? $fallback : ''
        )
    );
@endphp
@if($resolvedPreheader !== '')
{!! \App\Support\MailPreheader::hiddenHtml($resolvedPreheader) !!}
@endif
