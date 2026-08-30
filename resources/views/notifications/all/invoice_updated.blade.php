@php
    $title = __('email.invoice.updateSubject');
    $text = $notification->data['invoice_number'] ?? null;
    $linkRoute = 'invoices.show';
    $linkParam = $notification->data['id'] ?? null;
@endphp
@include('notifications.all._generic')
