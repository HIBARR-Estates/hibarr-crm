@php
    $title = __('email.newExpense.subject');
    $text = $notification->data['item_name'] ?? null;
    $linkRoute = 'expenses.show';
    $linkParam = $notification->data['id'] ?? null;
@endphp
@include('notifications.all._generic')
