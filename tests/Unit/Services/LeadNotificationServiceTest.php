<?php

namespace Tests\Unit\Services;

use App\Models\DealFollowUp;
use App\Models\EmployeeDetails;
use App\Models\LeadAgent;
use App\Models\User;
use App\Services\LeadNotificationService;
use Tests\TestCase;

class LeadNotificationServiceTest extends TestCase
{
    public function test_resolve_overdue_recipients_includes_agent_and_manager(): void
    {
        $manager = $this->makeUser(20);
        $agent = $this->makeUser(21);
        $employeeDetail = new EmployeeDetails(['reporting_to' => $manager->id]);
        $employeeDetail->setRelation('reportingTo', $manager);
        $agent->setRelation('employeeDetail', $employeeDetail);

        $leadAgent = new LeadAgent(['user_id' => $agent->id]);
        $leadAgent->setRelation('user', $agent);

        $followUp = new DealFollowUp([
            'deal_id' => 99,
            'lead_id' => 5,
            'next_follow_up_date' => now()->subDay(),
        ]);

        $followUp->setRelation('deal', (object) [
            'leadAgent' => $leadAgent,
        ]);
        $followUp->setRelation('lead', null);

        $recipients = app(LeadNotificationService::class)->resolveOverdueRecipients($followUp);

        $this->assertTrue($recipients->contains(fn (User $user) => $user->id === $agent->id));
        $this->assertTrue($recipients->contains(fn (User $user) => $user->id === $manager->id));
    }

    private function makeUser(int $id): User
    {
        $user = new User([
            'name' => 'User '.$id,
            'email' => 'user'.$id.'@example.com',
            'status' => 'active',
            'email_notifications' => true,
        ]);
        $user->id = $id;
        $user->exists = true;

        return $user;
    }
}
