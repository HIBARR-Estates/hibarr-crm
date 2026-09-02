@php
    $title = $notification->data['heading'] ?? '';
    $text = $notification->data['text'] ?? null;
    $linkUrl = $notification->data['download_url'] ?? null;
    $linkRoute = $linkUrl ? null : 'properties.show';
    $linkParam = $notification->data['property_id'] ?? null;
@endphp
@include('notifications.all._generic')
