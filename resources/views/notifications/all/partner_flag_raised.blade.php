@php
    $title = $notification->data['heading'] ?? '';
    $text = $notification->data['description'] ?? $notification->data['text'] ?? null;
    $linkUrl = $notification->data['action_url'] ?? null;
@endphp
@include('notifications.all._generic')
