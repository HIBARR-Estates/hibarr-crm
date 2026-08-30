@php
    $title = $notification->data['title'] ?? $notification->data['heading'] ?? '';
    $text = $notification->data['text'] ?? null;
    $linkRoute = 'tasks.show';
    $linkParam = $notification->data['task_id'] ?? $notification->data['id'] ?? null;
@endphp
@include('notifications.all._generic')
