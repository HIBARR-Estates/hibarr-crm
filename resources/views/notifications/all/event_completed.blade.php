@php
    $title = __('email.newEvent.statusSubject');
    $text = $notification->data['event_name'] ?? null;
    $linkRoute = 'events.show';
    $linkParam = $notification->data['id'] ?? null;
@endphp
@include('notifications.all._generic')
