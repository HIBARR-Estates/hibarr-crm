@php
    $title = 'New Issue Reported';
    $text = isset($notification->data['description']) ? \Illuminate\Support\Str::limit($notification->data['description'], 120) : null;
    $linkRoute = 'projects.show';
    $linkParam = $notification->data['project_id'] ?? null;
@endphp
@include('notifications.all._generic')
