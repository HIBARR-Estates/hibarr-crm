@php
    $title = $notification->data['heading'] ?? '';
    $text = $notification->data['text'] ?? null;
    $linkRoute = 'deals.show';
    $linkParam = $notification->data['deal_id'] ?? $notification->data['id'] ?? null;
@endphp
@include('notifications.all._generic')
