<?php

namespace Modules\Sms\Listeners;

use App\Events\TicketEvent;
use App\Models\User;
use Illuminate\Support\Facades\Notification;
use Modules\Sms\Notifications\NewTicketSms;
use Modules\Sms\Notifications\TicketAgentSms;

class SmsTicketListener
{
    /**
     * Handle the event.
     *
     * @return void
     */
    public function handle(TicketEvent $event)
    {
        try {
            if ($event->notificationName == 'NewTicket') {
                Notification::send(User::allAdmins($event->ticket->company->id), new NewTicketSms($event->ticket));
            }
            elseif ($event->notificationName == 'TicketAgent') {
                Notification::send($event->ticket->agent, new TicketAgentSms($event->ticket));
            }
        } catch (\Exception $e) { // @codingStandardsIgnoreLine
        }
    }

}
