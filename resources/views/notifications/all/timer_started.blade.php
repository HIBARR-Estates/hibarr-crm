@php
    $title = __('email.timerStarted.subject');
    $text = null;
    $linkRoute = 'timelogs.show';
    $linkParam = $notification->data['id'] ?? null;
@endphp
@include('notifications.all._generic')
