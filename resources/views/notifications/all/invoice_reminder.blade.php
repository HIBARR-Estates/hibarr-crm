{{-- App\Notifications\InvoiceReminder::toArray() returns $notifiable->toArray(),
     not the invoice — so invoice-specific fields/link can't be trusted here. --}}
@php
    $title = __('email.invoiceReminder.subject');
    $text = null;
    $linkRoute = null;
    $linkParam = null;
@endphp
@include('notifications.all._generic')
