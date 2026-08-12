{{-- OLD TEMPLATE - This template is kept for backward compatibility but new event reminders use mail.event.reminder --}}
@php
    // Prefer an explicit preheader; otherwise use the first plain-text line of $content.
    // Cap $content BEFORE strip_tags/preg_replace — those copy the full string (OOM risk).
    if (!isset($preheader) || $preheader === '' || $preheader === null) {
        $rawContent = !empty($content) ? (string) $content : '';
        if ($rawContent !== '' && strlen($rawContent) > 2000) {
            $rawContent = substr($rawContent, 0, 2000);
        }
        $preheader = $rawContent !== ''
            ? \Illuminate\Support\Str::limit(trim(preg_replace('/\s+/u', ' ', html_entity_decode(strip_tags(str_replace(['<br>', '<br/>', '<br />', '</p>', '</div>'], ' ', $rawContent)), ENT_QUOTES, 'UTF-8'))), 140)
            : '';
    } else {
        $preheader = (string) $preheader;
        if (strlen($preheader) > 2000) {
            $preheader = substr($preheader, 0, 2000);
        }
    }
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
