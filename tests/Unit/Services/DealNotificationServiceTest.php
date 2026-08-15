<?php

namespace Tests\Unit\Services;

use App\Enums\DealActivityType;
use App\Models\Deal;
use App\Models\User;
use App\Services\DealNotificationService;
use Mockery;
use Tests\TestCase;

class DealNotificationServiceTest extends TestCase
{
    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function test_get_notifiable_users_falls_back_to_admins_when_unassigned(): void
    {
        $admin = $this->makeUser(50);
        $deal = new Deal(['company_id' => 7]);
        $deal->setRelation('leadAgent', null);
        $deal->setRelation('dealWatchers', collect());
        $deal->setRelation('dealParticipants', collect());

        $service = Mockery::mock(DealNotificationService::class)->makePartial();
        $service->shouldAllowMockingProtectedMethods();
        $service->shouldReceive('activeAdminsForCompany')
            ->once()
            ->with(7, null, [])
            ->andReturn(collect([$admin]));

        $recipients = $service->getNotifiableUsers($deal);

        $this->assertCount(1, $recipients);
        $this->assertSame(50, $recipients->first()->id);
    }

    public function test_notify_meeting_cancelled_delegates_to_deal_activity(): void
    {
        $deal = new Deal(['name' => 'Pipeline deal']);
        $deal->id = 3;

        $service = Mockery::mock(DealNotificationService::class)->makePartial();
        $service->shouldReceive('notifyDealActivity')
            ->once()
            ->with(
                $deal,
                DealActivityType::MEETING_CANCELLED,
                [
                    'meeting_remark' => 'Strategy sync',
                    'meeting_date' => '2026-08-20T10:00:00+00:00',
                    'follow_up_id' => 12,
                ],
                7
            );

        $service->notifyMeetingCancelled(
            $deal,
            'Strategy sync',
            '2026-08-20T10:00:00+00:00',
            12,
            7
        );

        $this->addToAssertionCount(1);
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
