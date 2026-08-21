<?php

namespace Tests\Unit\Services;

use App\Models\Lead;
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

    public function test_get_notifiable_users_does_not_fall_back_to_admins_when_unassigned(): void
    {
        $lead = new Lead(['company_id' => 7]);
        $lead->setRelation('leadOwner', null);
        $lead->setRelation('company', null);

        $service = Mockery::mock(LeadNotificationService::class)->makePartial();
        $service->shouldAllowMockingProtectedMethods();
        $service->shouldReceive('activeAdminsForCompany')->never();

        $recipients = $service->getNotifiableUsers($lead);

        $this->assertTrue($recipients->isEmpty());
    }
}
