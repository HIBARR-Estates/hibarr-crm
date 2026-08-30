@php
    $title = __('email.estimateRequestAccepted.subject');
    $text = $notification->data['estimate_request_number'] ?? null;
    $linkRoute = 'estimate-request.show';
    $linkParam = $notification->data['id'] ?? null;
@endphp
@include('notifications.all._generic')
