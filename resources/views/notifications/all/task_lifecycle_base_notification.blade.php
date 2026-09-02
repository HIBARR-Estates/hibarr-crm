@php
    $title = $notification->data['title'] ?? $notification->data['heading'] ?? '';
    $text = $notification->data['text'] ?? null;
    $linkUrl = $notification->data['action_url'] ?? null;
@endphp
@include('notifications.all._generic')
