@php
    $title = $notification->data['heading'] ?? '';
    $text = $notification->data['description'] ?? null;
    $linkRoute = 'properties.show';
    $linkParam = $notification->data['property_id'] ?? null;
@endphp
@include('notifications.all._generic')
