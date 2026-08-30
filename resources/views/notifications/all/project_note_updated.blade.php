@php
    $title = __('email.projectNote.updateSubject');
    $text = $notification->data['title'] ?? $notification->data['project_name'] ?? null;
    $linkRoute = 'projects.show';
    $linkParam = $notification->data['project_id'] ?? null;
@endphp
@include('notifications.all._generic')
