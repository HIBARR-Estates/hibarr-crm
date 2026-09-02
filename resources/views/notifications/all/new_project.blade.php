@php
    $title = __('email.newProject.subject');
    $text = $notification->data['project_name'] ?? null;
    $linkRoute = 'projects.show';
    $linkParam = $notification->data['id'] ?? null;
@endphp
@include('notifications.all._generic')
