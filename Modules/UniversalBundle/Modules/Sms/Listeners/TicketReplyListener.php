<?php

namespace Modules\Sms\Listeners;

use App\Events\TicketReplyEvent;
use App\Models\User;
use Illuminate\Support\Facades\Notification;
use Modules\Sms\Notifications\NewTicketReply;

class TicketReplyListener
{
    /**
     * Handle the event.
     *
     * @return void
     */
    public function handle(TicketReplyEvent $event)
    {
        try {
            if (! is_null($event->notifyUser)) {
                Notification::send($event->notifyUser, new NewTicketReply($event->ticketReply));
            }
            else {
                Notification::send(User::allAdmins($event->ticketReply->ticket->company->id), new NewTicketReply($event->ticketReply));
            }
        } catch (\Exception $e) { // @codingStandardsIgnoreLine
        }
    }

}
