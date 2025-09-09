<?php

use App\Models\Company;
use Carbon\Carbon;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Modules\Performance\Entities\Objective;

return new class extends Migration
{

    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('key_results', function (Blueprint $table) {
            $table->decimal('target_value', 16, 2)->nullable()->change();
            $table->decimal('current_value', 16, 2)->nullable()->change();
        });

        $companies = Company::all();

        foreach ($companies as $company) {
            $objectives = Objective::with('keyResults')->where('company_id', $company->id)->get();

            foreach ($objectives as $objective) {
                foreach ($objective->keyResults as $keyResult) {
                    $nextCheckIn = $this->checkFrequency($objective);
                    $keyResult->next_check_in = $nextCheckIn->format('Y-m-d');
                }

                $objective->keyResults->each->save();
            }
        }

    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('', function (Blueprint $table) {
            $table->float('target_value')->nullable();
            $table->float('current_value')->nullable();
        });
    }

    private function checkFrequency($objective)
    {
        $startDate = Carbon::parse($objective->start_date);
        $frequency = $objective->check_in_frequency;

        if ($frequency == 'monthly' || $frequency == 'quarterly') {
            $schedule = $objective->rotation_date;
        }
        else {
            $schedule = $objective->schedule_on;
        }

        switch ($frequency) {
            case 'daily':
                // For daily, just add one day
                $nextCheckIn = $startDate->addDay();
                break;

            case 'weekly':
                // For weekly, calculate the next weekday (e.g., Monday)
                $nextCheckIn = $this->getNextWeekDay($startDate, $schedule);
                break;

            case 'bi-weekly':
                // For bi-weekly, calculate the next weekday with a 2-week interval
                $nextCheckIn = $this->getNextWeekDay($startDate, $schedule, 2); // bi-weekly
                break;

            case 'monthly':
                // For monthly, calculate based on a specific date (e.g., 15th or the specific weekday)
                $nextCheckIn = $this->getNextMonthDay($startDate, $schedule);
                break;

            case 'quarterly':
                // For quarterly, calculate based on quarterly schedule
                $nextCheckIn = $this->getNextQuarterDay($startDate, $schedule);
                break;

            default:
                // If no match, return the start date
                $nextCheckIn = $startDate;
                break;
        }

        return $nextCheckIn;
    }

    /**
     * Helper function to get the next weekday (e.g., Monday, Tuesday, etc.)
     *
     * @param Carbon $startDate
     * @param string $schedule (Day of the week, e.g., "Monday")
     * @param int $interval Interval to add in case of bi-weekly (default 1)
     * @return Carbon
     */
    private function getNextWeekDay(Carbon $startDate, $schedule, $interval = 1)
    {
        $daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

        $dayOfWeek = str_replace('every-', '', $schedule);
        $targetDay = array_search(ucfirst($dayOfWeek), $daysOfWeek);

        $nextCheckIn = $startDate->copy();

        // Check if the start date is before the target weekday, if not, move forward by a week
        while ($nextCheckIn->dayOfWeek !== $targetDay) {
            $nextCheckIn->addDay();
        }

        // If the next target day is already past, add a week (for weekly or bi-weekly)
        if ($nextCheckIn->lt($startDate)) {
            $nextCheckIn->addWeeks(1);
        }

        // If it's bi-weekly, add 2 weeks after finding the first match
        $nextCheckIn->addWeeks(($interval - 1));

        return $nextCheckIn;
    }

    /**
     * Helper function to get the next day for monthly frequency
     *
     * @param Carbon $startDate
     * @param string $schedule
     * @return Carbon
     */
    private function getNextMonthDay(Carbon $startDate, $schedule)
    {
        $nextDate = $startDate->copy();
        $nextDate->day = $schedule;

        // Check if the schedule day exceeds the days in the current month
        if ($nextDate->month != $startDate->month) {
            // Check for February
            if ($nextDate->month == 2) {
                $daysInMonth = $nextDate->isLeapYear() ? 29 : 28;
            }
            else {
                $daysInMonth = $nextDate->daysInMonth;
            }

            if ($schedule > $daysInMonth) {
                $nextDate->day = $daysInMonth;
            }
        }

        // If the next calculated date is earlier than the start date, increment by one month
        if ($nextDate->lessThan($startDate)) {
            $nextDate->addMonth();
        }

        return $nextDate;
    }

    /**
     * Helper function to get the next quarterly date
     *
     * @param Carbon $startDate
     * @param string $schedule
     * @return Carbon
     */
    private function getNextQuarterDay(Carbon $startDate, $schedule)
    {
        $nextDate = $startDate->copy();
        $nextDate->day = $schedule;
        $nextDate->addMonths(3);
        $daysInMonth = $nextDate->daysInMonth;

        // If the schedule day exceeds the number of days in the month, set the date to the last valid day of the month
        if ($schedule > $daysInMonth) {
            $nextDate->day = $daysInMonth;
        }

        // If the next calculated date is earlier than the start date, increment by one more quarter
        if ($nextDate->lessThan($startDate)) {
            $nextDate->addMonths(3);
        }

        return $nextDate;
    }

};
