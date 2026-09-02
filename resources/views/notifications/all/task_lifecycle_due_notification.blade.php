@php
    $title = $notification->data['title'] ?? __('email.taskLifecycle.due.subject');
    $text = $notification->data['text'] ?? $notification->data['heading'] ?? null;
    $linkUrl = $notification->data['action_url'] ?? null;
@endphp
@include('notifications.all._generic')
