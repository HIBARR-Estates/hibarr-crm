@php
    $title = $notification->data['title'] ?? __('email.leadAgentAssigned.subject');
    $text = $notification->data['text'] ?? null;
    $linkRoute = 'lead-contact.show';
    $linkParam = $notification->data['id'] ?? null;
@endphp
@include('notifications.all._generic')
