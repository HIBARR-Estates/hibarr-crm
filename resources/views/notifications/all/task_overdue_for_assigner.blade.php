@php
    $title = $notification->data['title'] ?? __('email.taskOverdue.assignerSubject');
    $text = $notification->data['text'] ?? $notification->data['heading'] ?? null;
    $linkRoute = 'tasks.show';
    $linkParam = $notification->data['task_id'] ?? $notification->data['id'] ?? null;
@endphp
@include('notifications.all._generic')
