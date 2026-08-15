<?php

namespace Tests\Unit\Services;

use App\Models\Lead;
use App\Models\User;
use App\Services\LeadNotificationService;
use Mockery;
use Tests\TestCase;

class LeadNotificationServiceTest extends TestCase
{
    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function test_get_notifiable_users_falls_back_to_admins_when_unassigned(): void
    {
        $admin = $this->makeUser(50);
        $lead = new Lead(['company_id' => 7]);
        $lead->setRelation('leadOwner', null);
        $lead->setRelation('company', null);

        $service = Mockery::mock(LeadNotificationService::class)->makePartial();
        $service->shouldAllowMockingProtectedMethods();
        $service->shouldReceive('activeAdminsForCompany')
            ->once()
            ->with(7, null)
            ->andReturn(collect([$admin]));

        $recipients = $service->getNotifiableUsers($lead);

        $this->assertCount(1, $recipients);
        $this->assertSame(50, $recipients->first()->id);
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
