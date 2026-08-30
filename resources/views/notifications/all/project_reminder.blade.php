@php
    $title = $notification->data['title'] ?? __('email.projectReminder.subject');
    $text = $notification->data['text'] ?? $notification->data['heading'] ?? null;
    $linkRoute = 'projects.show';
    $linkParam = $notification->data['project_id'] ?? $notification->data['id'] ?? null;
@endphp
@include('notifications.all._generic')
