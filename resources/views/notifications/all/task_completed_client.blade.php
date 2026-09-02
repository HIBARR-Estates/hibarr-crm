@php
    $title = __('email.taskComplete.subject');
    $text = $notification->data['heading'] ?? null;
    $linkRoute = 'tasks.show';
    $linkParam = $notification->data['task_id'] ?? $notification->data['id'] ?? null;
@endphp
@include('notifications.all._generic')
