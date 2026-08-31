@php
    $leadsCount = is_array($notification->data['leads'] ?? null) ? count($notification->data['leads']) : null;
    $title = __('email.leads.subject');
    $text = $leadsCount !== null ? trans_choice('email.leads.imported', $leadsCount, ['count' => $leadsCount]) : null;
    $linkRoute = 'lead-contact.index';
    $linkParam = null;
@endphp
@include('notifications.all._generic')
