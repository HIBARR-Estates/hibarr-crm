<?php

namespace Modules\Sms\Listeners;

use App\Events\NewExpenseEvent;
use App\Models\User;
use Illuminate\Support\Facades\Notification;
use Modules\Sms\Notifications\NewExpenseAdminSms;
use Modules\Sms\Notifications\NewExpenseMemberSms;

class SmsNewExpenseListener
{
    /**
     * Handle the event.
     *
     * @param  object  $event
     * @return void
     */
    public function handle(NewExpenseEvent $event)
    {
        try {
            if ($event->status == 'admin') {
                Notification::send($event->expense->user, new NewExpenseMemberSms($event->expense));
            }
            elseif ($event->status == 'member') {
                Notification::send(User::allAdmins($event->expense->company->id), new NewExpenseAdminSms($event->expense));
            }
        } catch (\Exception $e) { // @codingStandardsIgnoreLine
        }
    }

}
