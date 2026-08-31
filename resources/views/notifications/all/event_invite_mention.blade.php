@php
    $title = $notification->data['title'] ?? __('email.newEvent.mentionSubject');
    $text = $notification->data['text'] ?? $notification->data['event_name'] ?? null;
    $linkRoute = 'events.show';
    $linkParam = $notification->data['event_id'] ?? $notification->data['id'] ?? null;
@endphp
@include('notifications.all._generic')
