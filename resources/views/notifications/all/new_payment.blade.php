@php
    $title = __('email.payment.subject');
    $text = isset($notification->data['amount']) ? currency_format($notification->data['amount'], $notification->data['currency_id'] ?? null) : null;
    $linkRoute = 'payments.show';
    $linkParam = $notification->data['id'] ?? null;
@endphp
@include('notifications.all._generic')
