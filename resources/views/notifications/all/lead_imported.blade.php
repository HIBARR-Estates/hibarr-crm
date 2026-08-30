@php
    $leadsCount = is_array($notification->data['leads'] ?? null) ? count($notification->data['leads']) : null;
    $title = __('email.leads.subject');
    $text = $leadsCount !== null ? $leadsCount.' '.($leadsCount === 1 ? 'lead' : 'leads').' imported' : null;
    $linkRoute = 'lead-contact.index';
    $linkParam = null;
@endphp
@include('notifications.all._generic')
