<?php

namespace Modules\Sms\Listeners;

use App\Events\NewExpenseRecurringEvent;
use Illuminate\Support\Facades\Notification;
use Modules\Sms\Notifications\ExpenseRecurringStatus;

class NewExpenseRecurringListener
{
    /**
     * Handle the event.
     *
     * @return void
     */
    public function handle(NewExpenseRecurringEvent $event)
    {
        try {
            if ($event->status == 'status') {
                Notification::send($event->expense->user, new ExpenseRecurringStatus($event->expense));
            }
        } catch (\Exception $e) { // @codingStandardsIgnoreLine
        }
    }

}
