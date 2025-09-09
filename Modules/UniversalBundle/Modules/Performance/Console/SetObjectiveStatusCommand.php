<?php

namespace Modules\Performance\Console;

use Carbon\Carbon;
use App\Models\Company;
use Illuminate\Console\Command;
use Modules\Performance\Entities\Objective;
use Modules\Performance\Entities\ObjectiveProgressStatus;

class SetObjectiveStatusCommand extends Command
{

    /**
     * The name and signature of the console command.
     */
    protected $signature = 'performance:set-objective-status';

    /**
     * The console command description.
     */
    protected $description = 'This Command will set objective status.';

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
        $today = Carbon::now();

        Company::active()->select('id')->chunk(50, function ($companies) use ($today) {

            foreach ($companies as $company) {

                $objectives = Objective::where('company_id', $company->id)->get();

                foreach ($objectives as $objective) {

                    // Check if the objective's dates are equal to or between today..
                    $startDate = Carbon::parse($objective->start_date);
                    $endDate = Carbon::parse($objective->end_date);

                    $keyResults = $objective->keyResults;

                    $totalKey = 0;
                    $totalKeyPercnt = 0;

                    foreach ($keyResults as $key => $keyResult) {
                        $keyResultPercentage = $keyResult->key_percentage;
                        $totalKeyPercnt += round($keyResultPercentage, 2);
                        $totalKey = $key + 1;
                    }

                    // Objective progress...
                    $objectiveProgress = $totalKey > 0 ? $totalKeyPercnt / $totalKey : 0;

                    if ($endDate < $today && $objectiveProgress < 100) {
                        $objectiveProgressStatus = [
                            'objective_id' => $objective->id,
                            'status' => 'offTrack',
                            'objective_progress' => $objectiveProgress,
                            'time_left_percentage' => 0.00,
                            'color' => 'danger',
                        ];

                        ObjectiveProgressStatus::updateOrCreate(
                            ['objective_id' => $objective->id],
                            $objectiveProgressStatus
                        );
                    }
                    elseif ($startDate->isToday() || $endDate->isToday() || ($startDate <= $today && $endDate >= $today)) {

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
                        elseif (($objectiveProgress == 0.0 || ($objectiveProgress >= 40 && $objectiveProgress <= 60)) && $timeLeftPercentage <= 50) {
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
                            ['objective_id' => $objective->id],
                            $objectiveProgressStatus
                        );
                    }
                }
            }
        });

        return Command::SUCCESS;
    }

}
