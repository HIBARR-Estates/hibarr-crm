<?php

namespace App\Listeners;

use App\Events\EmployeeShiftChangeEvent;
use App\Models\User;
use App\Notifications\ShiftChangeRequest;
use App\Notifications\ShiftChangeStatus;
use Illuminate\Support\Facades\Notification;

class EmployeeShiftChangeListener
{

    /**
     * Handle the event.
     *
     * @param EmployeeShiftChangeEvent $event
     * @return void
     */
    public function handle(EmployeeShiftChangeEvent $event)
    {
        if (!is_null($event->statusChange)) {
            Notification::send($event->changeRequest->shiftSchedule->user, new ShiftChangeStatus($event->changeRequest));

        }
        else {
            // TODO: notify users with manage_employee_shifts = all.
            $companyId = $event->changeRequest->company_id
                ?? $event->changeRequest->shiftSchedule?->user?->company_id;
            if (! $companyId) {
                return;
            }
            Notification::send(
                User::allAdmins($companyId),
                new ShiftChangeRequest($event->changeRequest),
            );
        }

    }

}
