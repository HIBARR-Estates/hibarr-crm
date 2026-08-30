@php
    $title = $notification->data['heading'] ?? '';
    $text = $notification->data['text'] ?? $notification->data['description'] ?? null;
    $linkUrl = $notification->data['action_url'] ?? null;
@endphp
@include('notifications.all._generic')
