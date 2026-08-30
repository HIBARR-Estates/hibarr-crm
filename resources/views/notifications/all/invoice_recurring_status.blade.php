@php
    $title = __('email.invoiceRecurringStatus.subject');
    $text = $notification->data['invoice_number'] ?? null;
    $linkRoute = 'invoices.show';
    $linkParam = $notification->data['id'] ?? null;
@endphp
@include('notifications.all._generic')
