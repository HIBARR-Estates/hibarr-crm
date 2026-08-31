@php
    $title = __('email.paymentReminder.subject');
    $text = $notification->data['heading'] ?? null;
    $linkRoute = 'invoices.show';
    $linkParam = $notification->data['id'] ?? null;
@endphp
@include('notifications.all._generic')
