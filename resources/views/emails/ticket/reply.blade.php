@include('mail.partials.preheader', [
    'preheader' => $preheader ?? ($ticketReply->ticket->subject ?? ''),
])
{!! clean_html($ticketReply->message) !!}
