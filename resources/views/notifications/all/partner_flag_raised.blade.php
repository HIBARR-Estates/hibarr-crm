@php
    $title = $notification->data['heading'] ?? '';
    $text = $notification->data['description'] ?? null;
    $linkRoute = 'lead-contact.show';
    $linkParam = $notification->data['lead_id'] ?? null;
@endphp
@include('notifications.all._generic')
