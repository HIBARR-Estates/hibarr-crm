@php
    $title = __('email.newContract.subject');
    $text = $notification->data['subject'] ?? null;
    $linkRoute = 'contracts.show';
    $linkParam = $notification->data['id'] ?? null;
@endphp
@include('notifications.all._generic')
