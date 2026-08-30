@php
    $title = 'Timer Started';
    $text = null;
    $linkRoute = 'timelogs.show';
    $linkParam = $notification->data['id'] ?? null;
@endphp
@include('notifications.all._generic')
