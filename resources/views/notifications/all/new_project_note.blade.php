@php
    $title = __('email.projectNote.subject');
    $text = $notification->data['title'] ?? null;
    $linkRoute = 'projects.show';
    $linkParam = $notification->data['project_id'] ?? $notification->data['id'] ?? null;
@endphp
@include('notifications.all._generic')
