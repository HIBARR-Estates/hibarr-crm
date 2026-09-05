@php
    $title = __('email.estimate.subject');
    $text = $notification->data['estimate_number'] ?? null;
    $linkRoute = 'estimates.show';
    $linkParam = $notification->data['id'] ?? null;
@endphp
@include('notifications.all._generic')
