<?php

namespace Modules\Performance\Observers;

use App\Traits\HasCompany;
use Carbon\Carbon;
use Modules\Performance\Entities\CheckIn;
use Modules\Performance\Entities\KeyResults;
use Modules\Performance\Entities\Objective;
use Modules\Performance\Entities\ObjectiveProgressStatus;

class CheckInObserver
{

    Use HasCompany;

    public function creating(CheckIn $model)
    {
        if (company()) {
            $model->company_id = company()->id;
            $model->check_in_by = user()->id;
        }
    }

    public function created(CheckIn $CheckIn)
    {
        $keyId = $CheckIn->key_result_id;
        $this->setObjectiveStatus($keyId);
    }

    public function updated(CheckIn $checkIn)
    {
        $keyId = $checkIn->key_result_id;
        $this->setObjectiveStatus($keyId);
    }

    public function deleting(CheckIn $CheckIn)
    {
        $keyId = $CheckIn->key_result_id;
        $keyResult = KeyResults::findOrFail($keyId);

        $latestCheckIn = CheckIn::where('key_result_id', $keyId)->where('id', '!=', $CheckIn->id)->latest()->first();

        if ($latestCheckIn) {
            $keyResult->current_value = $latestCheckIn->current_value;
        }
        else {
            $keyResult->current_value = $keyResult->original_current_value;
        }

        $originalCurrentValue = $keyResult->original_current_value;
        $targetValue = $keyResult->target_value;
        $currentValue = $keyResult->current_value;

        // Calculate percentage based on the relationship between current and target values
        if ($currentValue > $targetValue) {
            // Current value is greater than target value
            $percentage = $this->calculateProgressPercentage($currentValue, $originalCurrentValue, $targetValue);
        }
        else {
            // Current value is less than or equal to target value
            $percentage = $this->calculateProgressPercentage($currentValue, $originalCurrentValue, $targetValue);
        }

        $keyResult->key_percentage = $percentage;
        $keyResult->save();

        $this->setObjectiveStatus($keyId);
    }

    public function calculateProgressPercentage($currentValue, $originalCurrentValue, $targetValue)
    {
        // If current value equals the target value, return 100%
        if ($currentValue == $targetValue) {
            return 100.0;
        }

        // If current value equals the original current value, return 0%
        if ($currentValue == $originalCurrentValue) {
            return 0.0;
        }

        // If current value is less than the target value
        if ($currentValue < $targetValue && $targetValue > $originalCurrentValue) {
            // Calculate progress based on original value
            return round((($currentValue - $originalCurrentValue) / ($targetValue - $originalCurrentValue)) * 100, 2);
        }

        // If current value is between the target and original current value, calculate progress
        if ($currentValue > $targetValue && $currentValue < $originalCurrentValue) {
            return round((($originalCurrentValue - $currentValue) / ($originalCurrentValue - $targetValue)) * 100, 2);
        }

        // If current value is greater than the target value, return 100%
        if ($currentValue > $targetValue || ($currentValue < $targetValue && $targetValue < $originalCurrentValue)) {
            return 100.00;
        }

        // If current value is greater than the original current value, return 0%
        return 0.00;
    }

    public function setObjectiveStatus($keyId)
    {
        $keyResult = KeyResults::findOrFail($keyId);
        $objective = Objective::with('keyResults')->where('id', $keyResult->objective_id)->first();

        if ($keyResult && $objective && $objective->keyResults) {

            $totalKey = 0;
            $totalKeyPercnt = 0;
            $today = Carbon::now();

            foreach ($objective->keyResults as $key => $keyResult) {
                $keyResultPercentage = $keyResult->key_percentage;
                $totalKeyPercnt += round($keyResultPercentage, 2);
                $totalKey = $key + 1;
            }

            // Objective progress...
            $objectiveProgress = $totalKey > 0 ? $totalKeyPercnt / $totalKey : 0;

            // Time Left Formula...
            $startDate = Carbon::parse($objective->start_date);
            $endDate = Carbon::parse($objective->end_date);

            $totalDays = $startDate->diffInDays($endDate);

            if ($totalDays > 0) {
                $elapsedDays = $startDate->diffInDays($today);
                $remainingDays = $totalDays - $elapsedDays;
                $timeLeftPercentage = ($remainingDays / $totalDays) * 100;
            }
            else {
                // If start and end dates are the same, no time left
                $timeLeftPercentage = 0;
            }

            $status = '';

            if ($objectiveProgress >= 100) {
                $status = 'completed';
                $color = 'primary';
            }
            elseif ($objectiveProgress > 70 && $timeLeftPercentage > 50) {
                $status = 'onTrack';
                $color = 'success';
            }
            elseif ($objectiveProgress > 60 && $timeLeftPercentage <= 50) {
                $status = 'atRisk';
                $color = 'warning';
            }
            elseif ($objectiveProgress >= 40 && $objectiveProgress <= 60 && $timeLeftPercentage <= 50) {
                $status = 'offTrack';
                $color = 'danger';
            }
            else {
                $status = 'onTrack';
                $color = 'success';
            }

            $objectiveProgressStatus = [
                'objective_id' => $objective->id,
                'status' => $status,
                'objective_progress' => $objectiveProgress,
                'time_left_percentage' => $timeLeftPercentage,
                'color' => $color,
            ];

            ObjectiveProgressStatus::updateOrCreate(
                ['objective_id' => $objective->id], $objectiveProgressStatus
            );
        }
    }

}
