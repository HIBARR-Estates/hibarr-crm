@php
    $title = __('email.holidays.subject');
    $text = $notification->data['holiday_name'] ?? null;
    $linkRoute = 'holidays.show';
    $linkParam = $notification->data['id'] ?? null;
@endphp
@include('notifications.all._generic')
