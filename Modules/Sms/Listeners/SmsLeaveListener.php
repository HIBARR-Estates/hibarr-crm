<?php

namespace Modules\Sms\Listeners;

use App\Events\LeaveEvent;
use App\Models\User;
use Illuminate\Support\Facades\Notification;
use Modules\Sms\Notifications\LeaveApplicationSms;
use Modules\Sms\Notifications\LeaveStatusApproveSms;
use Modules\Sms\Notifications\LeaveStatusRejectSms;
use Modules\Sms\Notifications\LeaveStatusUpdate;
use Modules\Sms\Notifications\MultipleLeaveApplication;
use Modules\Sms\Notifications\NewLeaveRequestSms;
use Modules\Sms\Notifications\NewMultipleLeaveRequest;

class SmsLeaveListener
{
    /**
     * Handle the event.
     *
     * @param  object  $event
     * @return void
     */
    public function handle(LeaveEvent $event)
    {
        try {
            if ($event->status == 'created') {
                if (! is_null($event->multiDates)) {
                    Notification::send($event->leave->user, new MultipleLeaveApplication($event->leave, $event->multiDates));
                    Notification::send(User::allAdmins($event->leave->company->id), new NewMultipleLeaveRequest($event->leave, $event->multiDates));
                }
                else {
                    Notification::send($event->leave->user, new LeaveApplicationSms($event->leave));
                    Notification::send(User::allAdmins($event->leave->company->id), new NewLeaveRequestSms($event->leave));
                }

            } elseif ($event->status == 'statusUpdated') {
                if ($event->leave->status == 'approved') {
                    Notification::send($event->leave->user, new LeaveStatusApproveSms($event->leave));

                } else {
                    Notification::send($event->leave->user, new LeaveStatusRejectSms($event->leave));
                }
            } elseif ($event->status == 'updated') {
                Notification::send($event->leave->user, new LeaveStatusUpdate($event->leave));
            }
        } catch (\Exception $e) { // @codingStandardsIgnoreLine
        }
    }

}
