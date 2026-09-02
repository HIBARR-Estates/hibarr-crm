@php
    $title = __('email.newInvoiceRecurring.subject');
    $text = $notification->data['invoice_number'] ?? null;
    $linkRoute = 'recurring-invoices.show';
    $linkParam = $notification->data['id'] ?? null;
@endphp
@include('notifications.all._generic')
