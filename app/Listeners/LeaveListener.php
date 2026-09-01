<?php

namespace App\Listeners;

use App\Events\LeaveEvent;
use App\Models\EmployeeDetails;
use App\Notifications\LeaveApplication;
use App\Notifications\LeaveStatusApprove;
use App\Notifications\LeaveStatusReject;
use App\Notifications\LeaveStatusUpdate;
use App\Notifications\MultipleLeaveApplication;
use App\Notifications\NewLeaveRequest;
use App\Notifications\NewMultipleLeaveRequest;
use App\Models\User;
use Illuminate\Support\Facades\Notification;

class LeaveListener
{

    /**
     * Handle the event.
     *
     * @param LeaveEvent $event
     * @return void
     */

    public function handle(LeaveEvent $event)
    {
        // TODO: also notify users with approve_or_reject_leaves = all.
        $reportingTo = EmployeeDetails::where('user_id', $event->leave->user_id)->pluck('reporting_to')->toArray();
        $adminUserIds = User::allAdmins($event->leave->company->id)->pluck('id')->toArray();
        $notificationTo = array_values(array_unique(array_filter([
            ...$reportingTo,
            ...$adminUserIds,
        ])));
        $adminUsers = User::whereIn('id', $notificationTo)->get();

        if ($event->status == 'created') {
            if (!is_null($event->multiDates)) {
                Notification::send($event->leave->user, new MultipleLeaveApplication($event->leave, $event->multiDates));
                Notification::send($adminUsers, new NewMultipleLeaveRequest($event->leave, $event->multiDates));
            }
            else {
                Notification::send($event->leave->user, new LeaveApplication($event->leave));
                Notification::send($adminUsers, new NewLeaveRequest($event->leave));
            }
        }
        elseif ($event->status == 'statusUpdated') {
            if ($event->leave->status == 'approved') {
                Notification::send($event->leave->user, new LeaveStatusApprove($event->leave));
            }
            else {
                Notification::send($event->leave->user, new LeaveStatusReject($event->leave));
            }
        }
        elseif ($event->status == 'updated') {
            Notification::send($event->leave->user, new LeaveStatusUpdate($event->leave));
        }
    }

}
