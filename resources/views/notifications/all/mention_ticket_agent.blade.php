@php
    $title = $notification->data['title'] ?? __('email.ticketAgent.mentionSubject');
    $text = $notification->data['text'] ?? $notification->data['subject'] ?? null;
    $linkRoute = 'tickets.show';
    $linkParam = $notification->data['id'] ?? null;
@endphp
@include('notifications.all._generic')
