@include('mail.partials.preheader', [
    'preheader' => $preheader ?? ($ticketReply->ticket->subject ?? ''),
])
{!! $ticketReply->message !!}
