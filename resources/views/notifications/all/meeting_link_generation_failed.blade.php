@php
    $title = __('email.meetingLinkGenerationFailed.subject');
    $text = $notification->data['deal_name'] ?? null;
    $linkRoute = 'deals.show';
    $linkParam = $notification->data['deal_id'] ?? null;
@endphp
@include('notifications.all._generic')
