@php
    $title = $notification->data['title'] ?? __('email.taskDeleted.subject');
    $text = $notification->data['text'] ?? $notification->data['heading'] ?? null;
    $linkRoute = 'tasks.index';
    $linkParam = null;
@endphp
@include('notifications.all._generic')
