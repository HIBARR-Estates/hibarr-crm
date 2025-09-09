<?php

namespace Modules\Performance\Observers;

use App\Models\User;
use App\Traits\HasCompany;
use Modules\Performance\Entities\Objective;
use Modules\Performance\Entities\PerformanceSetting;
use Modules\Performance\Events\ObjectiveCreatedEvent;

class ObjectiveObserver
{

    Use HasCompany;

    public function creating(Objective $model)
    {
        if (company()) {
            $model->company_id = company()->id;
        }

        $model->created_by = user()->id;
    }

    public function created(Objective $objective)
    {
        $users = User::whereIn('id', request()->owner_id)->get();
        event(new ObjectiveCreatedEvent($objective, $users));
    }

    public function deleting(Objective $objective)
    {
        $objective = $objective::with('keyResults.checkIns')->find($objective->id);

        if ($objective && $objective->keyResults) {
            $checkInIds = $objective->keyResults->flatMap(function ($keyResult) {
                return $keyResult->checkIns->pluck('id');
            });

            if ($checkInIds->count() > 0) {
                $notifyData = ['Modules\Performance\Notifications\CheckInReminderNotification'];

                foreach ($checkInIds as $checkInId) {
                    \App\Models\Notification::deleteNotification($notifyData, $checkInId);
                }
            }
        }

        $notifyData = ['Modules\Performance\Notifications\NotifyAssigneeForObjective'];
        \App\Models\Notification::deleteNotification($notifyData, $objective->id);

    }

}
