@php
    $title = __('email.creditNote.subject');
    $text = $notification->data['cn_number'] ?? null;
    $linkRoute = 'creditnotes.show';
    $linkParam = $notification->data['id'] ?? null;
@endphp
@include('notifications.all._generic')
