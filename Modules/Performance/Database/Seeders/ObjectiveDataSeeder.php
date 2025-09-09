<?php

namespace Modules\Performance\Database\Seeders;

use App\Models\Company;
use Illuminate\Database\Seeder;
use Modules\Performance\Entities\CheckIn;
use Modules\Performance\Entities\GoalType;
use Modules\Performance\Entities\Objective;
use Modules\Performance\Entities\KeyResults;
use Modules\Performance\Entities\KeyResultsMetrics;

class ObjectiveDataSeeder extends Seeder
{

    /**
     * Run the database seeds.
     *
     * @return void
     */
    public function run($companyId)
    {
        $company = Company::find($companyId);

        $companyTypeGoal = GoalType::where('company_id', $company->id)->where('type', 'company')->first();

        // Objective 1: Increase Revenue
        $objectiveOneData = [
            'company_id' => $company->id,
            'title' => 'Increase Revenue',
            'description' => 'Focus on increasing revenue by 100% this quarter.',
            'goal_type' => $companyTypeGoal ? $companyTypeGoal->id : 'company',
            'department_id' => null,
            'start_date' => now(),
            'end_date' => now()->addMonths(3),
            'priority' => 'high',
            'check_in_frequency' => 'weekly',
            'schedule_on' => 'every-monday',
            'send_check_in_reminder' => false,
            'created_by' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ];

        Objective::insert($objectiveOneData);

        $objective1 = Objective::where('company_id', $company->id)->where('title', 'Increase Revenue')->first();
        $objective1->owners()->attach(1);

        // Key Result for Objective 1
        $keyResultsData = [
            [
                'company_id' => $company->id,
                'objective_id' => $objective1->id,
                'title' => 'Increase Online Sales',
                'description' => 'Increase online sales by 100% within the quarter.',
                'metrics_id' => KeyResultsMetrics::where('company_id', $company->id)->where('name', 'Revenue')->first()->id,
                'target_value' => 100,
                'current_value' => 0,
                'original_current_value' => 0,
                'key_percentage' => 0.00,
                'next_check_in' => now()->addWeek(),
                'created_at' => now(),
                'updated_at' => now(),
            ]
        ];

        KeyResults::insert($keyResultsData);

        // Check-In for Key Result 1
        $keyResult1 = KeyResults::where('company_id', $company->id)->where('objective_id', $objective1->id)->where('title', 'Increase Online Sales')->first();

        if ($keyResult1) {
            $checkInData = [
                'company_id' => $company->id,
                'key_result_id' => $keyResult1->id,
                'progress_update' => 'We have seen an increase of 75% in online sales so far.',
                'current_value' => 75,
                'objective_percentage' => 75,
                'confidence_level' => 'medium',
                'barriers' => 'Delayed product launches',
                'check_in_date' => now(),
                'check_in_by' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ];

            CheckIn::insert($checkInData);

            // Updating Key Result after Check-In
            $checkInCurrentValue = $checkInData['current_value'];
            $keyResult1->current_value = $checkInCurrentValue;

            if ($checkInCurrentValue >= $keyResult1->original_current_value && $checkInCurrentValue <= $keyResult1->target_value) {
                $keyResult1->key_percentage = round(($checkInCurrentValue / $keyResult1->target_value) * 100, 2);
            } else {
                $keyResult1->key_percentage = 0.00;
            }

            $keyResult1->last_check_in = now();
            $keyResult1->save();
        }

        // Objective 2: Improve Customer Satisfaction
        $objectiveTwoData = [
            'company_id' => $company->id,
            'title' => 'Improve Customer Satisfaction',
            'description' => 'Increase the CSAT score to 100% this quarter.',
            'goal_type' => $companyTypeGoal ? $companyTypeGoal->id : 'company',
            'department_id' => null,
            'start_date' => now(),
            'end_date' => now()->addMonths(3),
            'priority' => 'medium',
            'check_in_frequency' => 'bi-weekly',
            'schedule_on' => 'every-monday',
            'send_check_in_reminder' => false,
            'created_by' => 1,
            'created_at' => now()->addMonth(1),
            'updated_at' => now(),
        ];

        Objective::insert($objectiveTwoData);
        $objective2 = Objective::where('company_id', $company->id)->where('title', 'Improve Customer Satisfaction')->first();
        $objective2->owners()->attach(2);

        // Key Result for Objective 2
        $keyResultsData2 = [
            [
                'company_id' => $company->id,
                'objective_id' => $objective2->id,
                'title' => 'Improve Net Promoter Score',
                'description' => 'Increase NPS score by 100 points this quarter.',
                'metrics_id' => KeyResultsMetrics::where('company_id', $company->id)->where('name', 'Percentage')->first()->id,
                'target_value' => 100,
                'current_value' => 0,
                'original_current_value' => 0,
                'key_percentage' => 0.00,
                'next_check_in' => now()->addWeeks(2),
                'created_at' => now(),
                'updated_at' => now(),
            ]
        ];

        KeyResults::insert($keyResultsData2);

        // Check-In for Key Result 2
        $keyResult2 = KeyResults::where('company_id', $company->id)->where('objective_id', $objective2->id)->where('title', 'Improve Net Promoter Score')->first();

        if ($keyResult2) {
            $checkInData2 = [
                'company_id' => $company->id,
                'key_result_id' => $keyResult2->id,
                'progress_update' => 'We have improved our NPS score by 50 points so far.',
                'current_value' => 50,
                'objective_percentage' => 50,
                'confidence_level' => 'high',
                'barriers' => 'No major barriers',
                'check_in_date' => now(),
                'check_in_by' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ];

            CheckIn::insert($checkInData2);

            // Updating Key Result after Check-In
            $checkInCurrentValue2 = $checkInData2['current_value'];
            $keyResult2->current_value = $checkInCurrentValue2;

            if ($checkInCurrentValue2 >= $keyResult2->original_current_value && $checkInCurrentValue2 <= $keyResult2->target_value) {
                $keyResult2->key_percentage = round(($checkInCurrentValue2 / $keyResult2->target_value) * 100, 2);
            } else {
                $keyResult2->key_percentage = 0.00;
            }

            $keyResult2->last_check_in = now();
            $keyResult2->save();
        }

        // Objective 3: Enhance Employee Productivity
        $objectiveThreeData = [
            'company_id' => $company->id,
            'title' => 'Enhance Employee Productivity',
            'description' => 'Increase employee productivity by 100% through new tools and training.',
            'goal_type' => GoalType::where('company_id', $company->id)->where('type', 'department')->first()->id,
            'department_id' => 1,
            'start_date' => now(),
            'end_date' => now()->addMonths(3),
            'priority' => 'low',
            'check_in_frequency' => 'monthly',
            'schedule_on' => 'every-monday',
            'send_check_in_reminder' => false,
            'created_by' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ];

        Objective::insert($objectiveThreeData);
        $objective3 = Objective::where('company_id', $company->id)->where('title', 'Enhance Employee Productivity')->first();
        $objective3->owners()->attach(3);

        // Key Result for Objective 3
        $keyResultsData3 = [
            [
                'company_id' => $company->id,
                'objective_id' => $objective3->id,
                'title' => 'Launch Employee Training Program',
                'description' => 'Complete the launch of an employee productivity training program.',
                'metrics_id' => KeyResultsMetrics::where('company_id', $company->id)->where('name', 'Units')->first()->id,
                'target_value' => 100,
                'current_value' => 0,
                'original_current_value' => 0,
                'key_percentage' => 0.00,
                'next_check_in' => now()->month(1),
                'created_at' => now(),
                'updated_at' => now(),
            ]
        ];

        KeyResults::insert($keyResultsData3);

        // Check-In for Key Result 3
        $keyResult3 = KeyResults::where('company_id', $company->id)->where('objective_id', $objective3->id)->where('title', 'Launch Employee Training Program')->first();

        if ($keyResult3) {
            $checkInData3 = [
                'company_id' => $company->id,
                'key_result_id' => $keyResult3->id,
                'progress_update' => 'The training program is in the planning stage.',
                'current_value' => 60,
                'objective_percentage' => 60,
                'confidence_level' => 'low',
                'barriers' => 'Pending budget approval',
                'check_in_date' => now(),
                'check_in_by' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ];

            CheckIn::insert($checkInData3);

            // Update Key Result after Check-In
            $checkInCurrentValue3 = $checkInData3['current_value'];
            $keyResult3->current_value = $checkInCurrentValue3;

            if ($checkInCurrentValue3 >= $keyResult3->original_current_value && $checkInCurrentValue3 <= $keyResult3->target_value) {
                $keyResult3->key_percentage = round(($checkInCurrentValue3 / $keyResult3->target_value) * 100, 2);
            }
            else {
                $keyResult3->key_percentage = 0.00;
            }

            $keyResult3->last_check_in = now();
            $keyResult3->save();
        }
    }

}
