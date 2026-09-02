@php
    $title = __('email.ticketReply.subject');
    $text = $notification->data['subject'] ?? null;
    $linkRoute = 'tickets.show';
    $linkParam = $notification->data['id'] ?? null;
@endphp
@include('notifications.all._generic')
