{{-- App\Notifications\NewCommunicationActivity — deal communication activity. --}}
@php
    $title = $notification->data['title'] ?? $notification->data['heading'] ?? 'New communication activity';
    $text = $notification->data['text'] ?? $notification->data['message'] ?? null;
    $linkRoute = 'deals.show';
    $linkParam = $notification->data['deal_id'] ?? $notification->data['id'] ?? null;
@endphp
@include('notifications.all._generic')
