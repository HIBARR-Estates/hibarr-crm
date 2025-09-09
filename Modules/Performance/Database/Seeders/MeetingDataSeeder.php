<?php

namespace Modules\Performance\Database\Seeders;

use App\Models\User;
use App\Models\Company;
use Illuminate\Database\Seeder;
use Modules\Performance\Entities\Action;
use Modules\Performance\Entities\Agenda;
use Modules\Performance\Entities\Meeting;
use Modules\Performance\Entities\PerformanceMeeting;
use Modules\Performance\Entities\PerformanceMeetingAgenda;
use Modules\Performance\Entities\PerformanceMeetingActions;

class MeetingDataSeeder extends Seeder
{

    /**
     * Run the database seeds.
     *
     * @return void
     */
    public function run($companyId)
    {
        $company = Company::find($companyId);

        $employees = User::allEmployees(null, true);

        if ($employees->count() < 3) {
            $this->command->error('Not enough employees to assign to the meetings!');
            return;
        }

        $meetingForUser = $employees->random();
        $meetingByUser = $employees->random();
        $addedByUser = $employees->random();

        // Meeting 1
        $performanceMeetingData1 = [
            'company_id' => $company->id,
            'parent_id' => null,
            'objective_id' => null,
            'start_date_time' => now()->addDays(2),
            'end_date_time' => now()->addDays(2)->addHours(1),
            'repeat' => 'no',
            'repeat_every' => null,
            'repeat_cycles' => null,
            'repeat_type' => null,
            'until_date' => null,
            'meeting_for' => $meetingForUser->id,
            'meeting_by' => $meetingByUser->id,
            'added_by' => $addedByUser->id,
            'status' => 'pending',
        ];

        $performanceMeeting1 = Meeting::create($performanceMeetingData1);

        // Create the first performance meeting agenda
        Agenda::create([
            'meeting_id' => $performanceMeeting1->id,
            'discussion_point' => 'Review progress on sales targets for the quarter.',
            'added_by' => $addedByUser->id,
            'is_discussed' => 'yes',
        ]);

        Agenda::create([
            'meeting_id' => $performanceMeeting1->id,
            'discussion_point' => 'Discuss challenges faced by the team.',
            'added_by' => $addedByUser->id,
            'is_discussed' => 'no',
        ]);

        // Create the first performance meeting actions
        Action::create([
            'meeting_id' => $performanceMeeting1->id,
            'action_point' => 'Follow up with the sales team on target achievement.',
            'added_by' => $addedByUser->id,
            'is_actioned' => 'no',
        ]);

        Action::create([
            'meeting_id' => $performanceMeeting1->id,
            'action_point' => 'Provide additional support to the marketing team.',
            'added_by' => $addedByUser->id,
            'is_actioned' => 'no',
        ]);

        // Meeting 2
        $performanceMeetingData2 = [
            'company_id' => $company->id,
            'parent_id' => null,
            'objective_id' => null,
            'start_date_time' => now()->addDays(3),
            'end_date_time' => now()->addDays(3)->addHours(1),
            'repeat' => 'yes',
            'repeat_every' => 'week',
            'repeat_cycles' => 4,
            'repeat_type' => 'after',
            'until_date' => now()->addMonths(3),
            'meeting_for' => $meetingForUser->id,
            'meeting_by' => $meetingByUser->id,
            'added_by' => $addedByUser->id,
            'status' => 'completed',
        ];

        $performanceMeeting2 = Meeting::create($performanceMeetingData2);

        // Create the second performance meeting agenda
        Agenda::create([
            'meeting_id' => $performanceMeeting2->id,
            'discussion_point' => 'Check project progress and milestones.',
            'added_by' => $addedByUser->id,
            'is_discussed' => 'no',
        ]);

        Agenda::create([
            'meeting_id' => $performanceMeeting2->id,
            'discussion_point' => 'Address any project delays and roadblocks.',
            'added_by' => $addedByUser->id,
            'is_discussed' => 'no',
        ]);

        // Create the second performance meeting actions
        Action::create([
            'meeting_id' => $performanceMeeting2->id,
            'action_point' => 'Ensure the project is back on track within the next week.',
            'added_by' => $addedByUser->id,
            'is_actioned' => 'no',
        ]);

        Action::create([
            'meeting_id' => $performanceMeeting2->id,
            'action_point' => 'Organize a follow-up meeting for feedback.',
            'added_by' => $addedByUser->id,
            'is_actioned' => 'no',
        ]);

        // Meeting 3
        $performanceMeetingData3 = [
            'company_id' => $company->id,
            'parent_id' => null,
            'objective_id' => null,
            'start_date_time' => now()->addDays(5),
            'end_date_time' => now()->addDays(5)->addHours(1),
            'repeat' => 'no',
            'repeat_every' => null,
            'repeat_cycles' => null,
            'repeat_type' => null,
            'until_date' => null,
            'meeting_for' => $meetingForUser->id,
            'meeting_by' => $meetingByUser->id,
            'added_by' => $addedByUser->id,
            'status' => 'cancelled',
        ];

        // Create the third performance meeting
        $performanceMeeting3 = Meeting::create($performanceMeetingData3);

        // Create the third performance meeting agenda
        Agenda::create([
            'meeting_id' => $performanceMeeting3->id,
            'discussion_point' => 'Evaluate the current employee satisfaction survey results.',
            'added_by' => $addedByUser->id,
            'is_discussed' => 'no',
        ]);

        Agenda::create([
            'meeting_id' => $performanceMeeting3->id,
            'discussion_point' => 'Plan employee engagement activities for the next quarter.',
            'added_by' => $addedByUser->id,
            'is_discussed' => 'no',
        ]);

        // Create the third performance meeting actions
        Action::create([
            'meeting_id' => $performanceMeeting3->id,
            'action_point' => 'Implement changes based on employee feedback.',
            'added_by' => $addedByUser->id,
            'is_actioned' => 'no',
        ]);

        Action::create([
            'meeting_id' => $performanceMeeting3->id,
            'action_point' => 'Organize team-building events next month.',
            'added_by' => $addedByUser->id,
            'is_actioned' => 'no',
        ]);
    }
}
