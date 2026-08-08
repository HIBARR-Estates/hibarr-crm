{{-- OLD TEMPLATE - This template is kept for backward compatibility but new event reminders use mail.event.reminder --}}
@php
    // Prefer an explicit preheader; otherwise use the first plain-text line of $content.
    $preheader = $preheader ?? (!empty($content)
        ? \Illuminate\Support\Str::limit(trim(preg_replace('/\s+/u', ' ', html_entity_decode(strip_tags(str_replace(['<br>', '<br/>', '<br />'], ' ', (string) $content)), ENT_QUOTES, 'UTF-8'))), 140)
        : '');
@endphp
@component('mail::message')
# @lang('email.hello')@if(!empty($notifiableName)){{ ' '.$notifiableName }}@endif!

@if (!empty($content))

@component('mail::text', ['text' => $content])

@endcomponent
@endif

@if (!empty($url))
    @component('mail::button', ['url' => $url, 'themeColor' => ((!empty($themeColor)) ? $themeColor : '#1f75cb')])
    {{ $actionText }}
    @endcomponent
@endif

@lang('email.regards'),<br>
{{ config('app.name') }}
@endcomponent
