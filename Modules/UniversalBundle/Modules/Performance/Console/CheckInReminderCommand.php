<?php

namespace Modules\Performance\Console;

use Carbon\Carbon;
use App\Models\Company;
use Illuminate\Console\Command;
use Modules\Performance\Entities\Objective;
use Modules\Performance\Entities\ObjectiveOwner;
use Modules\Performance\Notifications\CheckInReminderNotification;

class CheckInReminderCommand extends Command
{

    /**
     * The name and signature of the console command.
     */
    protected $signature = 'performance:send-check-in-reminder';

    /**
     * The console command description.
     */
    protected $description = 'Send reminder to assigne/owners to check-in objectives.';

    /**
     * Create a new command instance.
     */
    public function __construct()
    {
        parent::__construct();
    }

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $currentDate = now()->format('Y-m-d');

        Company::active()->select('id')->chunk(50, function ($companies) use ($currentDate) {
            foreach ($companies as $company) {
                $objectives = Objective::where('company_id', $company->id)
                    ->where('send_check_in_reminder', 1)
                    ->where('start_date', '<=', $currentDate)
                    ->where('end_date', '>=', $currentDate)
                    ->get();

                foreach ($objectives as $objective) {
                    if ($this->shouldSendReminder($objective, $currentDate)) {
                        $owners = ObjectiveOwner::where('objective_id', $objective->id)->with('user')->get();

                        foreach ($owners as $owner) {
                            if ($owner->user) {
                                $owner->user->notify(new CheckInReminderNotification($objective));
                            }
                        }
                    }
                }
            }
        });

        return Command::SUCCESS;
    }

    private function shouldSendReminder($objective, $currentDate)
    {
        $frequency = $objective->check_in_frequency;
        $startDate = Carbon::parse($objective->start_date);
        $endDate = Carbon::parse($objective->end_date);
        $currentCarbonDate = Carbon::parse($currentDate);

        switch ($frequency) {
            case 'daily':
                return true;

            case 'weekly':
                return $currentCarbonDate->isBetween($startDate, $endDate) &&
                    $this->isScheduledDay($objective->schedule_on, $currentCarbonDate);

            case 'bi-weekly':
                $daysSinceStart = $currentCarbonDate->diffInDays($startDate);
                return $currentCarbonDate->isBetween($startDate, $endDate) &&
                    $this->isScheduledDay($objective->schedule_on, $currentCarbonDate) &&
                    ($daysSinceStart % 14 === 0);

            case 'monthly':
                return $currentCarbonDate->isBetween($startDate, $endDate) &&
                    $this->isValidRotationDate($objective->rotation_date, $currentCarbonDate);

            case 'quarterly':
                return $this->shouldSendQuarterlyReminder($startDate, $endDate, $currentCarbonDate, $objective->rotation_date);

            default:
                return false;
        }
    }

    /**
     * Validate the rotation date for months with fewer than 31 days.
     * Triggers on the last day of the month if the rotation date exceeds the last day.
     */
    private function isValidRotationDate($rotationDate, $currentCarbonDate)
    {
        $lastDayOfMonth = $currentCarbonDate->copy()->endOfMonth()->day;

        if ($rotationDate > $lastDayOfMonth) {
            return $currentCarbonDate->day === $lastDayOfMonth;
        }

        return $currentCarbonDate->day == $rotationDate;
    }

    /**
     * Check if the current day matches the 'schedule_on' day.
     */
    private function isScheduledDay($scheduleOn, $currentCarbonDate)
    {
        switch ($scheduleOn) {
            case 'every-monday':
                return $currentCarbonDate->isMonday();
            case 'every-tuesday':
                return $currentCarbonDate->isTuesday();
            case 'every-wednesday':
                return $currentCarbonDate->isWednesday();
            case 'every-thursday':
                return $currentCarbonDate->isThursday();
            case 'every-friday':
                return $currentCarbonDate->isFriday();
            case 'every-saturday':
                return $currentCarbonDate->isSaturday();
            case 'every-sunday':
                return $currentCarbonDate->isSunday();
            default:
                return false;
        }
    }

    /**
     * Check if a quarterly reminder should be sent based on the start date.
     * Sends a reminder every 3 months on the specified rotation date.
     */
    private function shouldSendQuarterlyReminder($startDate, $endDate, $currentDate, $rotationDate)
    {
        if (!$currentDate->isBetween($startDate, $endDate)) {
            return false;
        }

        $lastDayOfMonth = $currentDate->copy()->endOfMonth()->day;
        $monthsSinceStart = $startDate->diffInMonths($currentDate);

        $rotationDay = $rotationDate > $lastDayOfMonth ? $lastDayOfMonth : $rotationDate;

        // Ensure the reminder is sent every 3 months on the exact same day as the start date or rotation date
        return $monthsSinceStart % 3 === 0 && $currentDate->day == $rotationDay;
    }

}
