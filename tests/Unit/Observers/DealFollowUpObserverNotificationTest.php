<?php

namespace Tests\Unit\Observers;

use App\Models\Deal;
use App\Models\DealFollowUp;
use App\Observers\DealFollowUpObserver;
use App\Services\DealActivityEventService;
use App\Services\DealAutomationService;
use App\Services\DealNotificationService;
use App\Services\Reminders\MeetingReminderSync;
use Carbon\Carbon;
use Mockery;
use Tests\TestCase;

class DealFollowUpObserverNotificationTest extends TestCase
{
    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function test_created_notifies_meeting_scheduled_for_deal_linked_follow_up(): void
    {
        config(['app.seeding' => false]);

        $deal = new Deal(['name' => 'Acme deal']);
        $deal->id = 10;

        $followUp = $this->makeFollowUp($deal, [
            'remark' => 'Discovery call',
        ]);

        $notificationService = Mockery::mock(DealNotificationService::class);
        $notificationService->shouldReceive('notifyMeetingScheduled')
            ->once()
            ->with($deal, 'Discovery call', Mockery::type('string'), 5, 99);

        $observer = $this->makeObserver($notificationService, null, true);
        $observer->created($followUp);

        $this->addToAssertionCount(1);
    }

    public function test_created_skips_notification_for_lead_only_follow_up(): void
    {
        config(['app.seeding' => false]);

        $followUp = new DealFollowUp([
            'lead_id' => 3,
            'deal_id' => null,
            'remark' => 'Discovery call',
            'status' => 'scheduled',
            'next_follow_up_date' => Carbon::parse('2026-08-20 10:00:00', 'UTC'),
            'added_by' => 99,
        ]);
        $followUp->id = 5;
        $followUp->exists = true;

        $notificationService = Mockery::mock(DealNotificationService::class);
        $notificationService->shouldNotReceive('notifyMeetingScheduled');

        $observer = $this->makeObserver($notificationService);
        $observer->created($followUp);

        $this->addToAssertionCount(1);
    }

    private function makeFollowUp(Deal $deal, array $overrides = []): DealFollowUp
    {
        $followUp = new DealFollowUp(array_merge([
            'deal_id' => $deal->id,
            'remark' => 'Discovery call',
            'status' => 'scheduled',
            'next_follow_up_date' => Carbon::parse('2026-08-20 10:00:00', 'UTC'),
            'added_by' => 99,
        ], $overrides));
        $followUp->id = 5;
        $followUp->exists = true;
        $followUp->setRelation('deal', $deal);

        return $followUp;
    }

    private function makeObserver(
        DealNotificationService $notificationService,
        ?MeetingReminderSync $meetingReminderSync = null,
        bool $expectsDealSideEffects = false,
    ): DealFollowUpObserver {
        $dealAutomation = Mockery::mock(DealAutomationService::class);
        if ($expectsDealSideEffects) {
            $dealAutomation->shouldReceive('process')->once();
        }

        $dealActivityEventService = Mockery::mock(DealActivityEventService::class);
        if ($expectsDealSideEffects) {
            $dealActivityEventService->shouldReceive('recordFollowUpCreated')->once();
        }

        return new DealFollowUpObserver(
            $dealAutomation,
            $notificationService,
            $dealActivityEventService,
            $meetingReminderSync ?? Mockery::mock(MeetingReminderSync::class),
        );
    }
}
