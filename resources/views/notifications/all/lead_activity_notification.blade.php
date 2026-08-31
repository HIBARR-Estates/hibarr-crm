@php
    $title = $notification->data['heading'] ?? '';
    $text = $notification->data['text'] ?? null;
    $linkRoute = 'lead-contact.show';
    $linkParam = $notification->data['lead_id'] ?? $notification->data['id'] ?? null;
@endphp
@include('notifications.all._generic')
