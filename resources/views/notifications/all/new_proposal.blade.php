@php
    $title = __('email.proposal.subject');
    $text = $notification->data['proposal_number'] ?? null;
    $linkRoute = 'proposals.show';
    $linkParam = $notification->data['id'] ?? null;
@endphp
@include('notifications.all._generic')
