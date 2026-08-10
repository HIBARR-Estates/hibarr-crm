<?php

namespace Tests\Feature\CalendarSync;

use App\Jobs\SyncCalendarEventJob;
use App\Models\DealFollowUp;
use App\Observers\DealFollowUpObserver;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\Concerns\SetsFeatureFlags;
use Tests\TestCase;

class ObserverDispatchTest extends TestCase
{
    use RefreshDatabase;
    use SetsFeatureFlags;

    public function test_observer_does_not_dispatch_calendar_sync_on_create(): void
    {
        $this->setFeatureFlag('integrations.zoho-calendar-sync', true);
        Queue::fake();

        $creator = User::factory()->create();

        $followUp = new DealFollowUp();
        $followUp->added_by = $creator->id;
        $followUp->next_follow_up_date = now();
        $followUp->duration = 30;
        $followUp->location = 'office';
        $followUp->meeting_link = '';
        $followUp->status = 'scheduled';
        $followUp->participants = [];
        $followUp->save();

        $observer = app(DealFollowUpObserver::class);
        $observer->created($followUp);

        Queue::assertNotPushed(SyncCalendarEventJob::class);
    }
}
