@php
    $title = $notification->data['title'] ?? __('email.taskPriorityUpdated.subject');
    $text = $notification->data['text'] ?? $notification->data['heading'] ?? null;
    $linkRoute = 'tasks.show';
    $linkParam = $notification->data['task_id'] ?? $notification->data['id'] ?? null;
@endphp
@include('notifications.all._generic')
