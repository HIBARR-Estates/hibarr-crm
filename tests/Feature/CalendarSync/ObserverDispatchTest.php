<?php

namespace Tests\Feature\CalendarSync;

use App\Jobs\SyncCalendarEventJob;
use App\Models\DealFollowUp;
use App\Observers\DealFollowUpObserver;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Tests\Concerns\SetsFeatureFlags;
use Tests\TestCase;

class ObserverDispatchTest extends TestCase
{
    use RefreshDatabase;
    use SetsFeatureFlags;

    public function test_it_dispatches_job_when_flag_enabled_without_zoho_id(): void
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

        Queue::assertPushed(SyncCalendarEventJob::class);
    }

    public function test_it_skips_job_when_flag_disabled(): void
    {
        $this->setFeatureFlag('integrations.zoho-calendar-sync', false);
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

        Queue::assertNothingPushed();
    }

    public function test_it_skips_job_when_creator_missing(): void
    {
        $this->setFeatureFlag('integrations.zoho-calendar-sync', true);
        Queue::fake();

        $followUp = new DealFollowUp();
        $followUp->added_by = null;
        $followUp->next_follow_up_date = now();
        $followUp->duration = 30;
        $followUp->location = 'office';
        $followUp->meeting_link = '';
        $followUp->status = 'scheduled';
        $followUp->participants = [];
        $followUp->save();

        $observer = app(DealFollowUpObserver::class);
        $observer->created($followUp);

        Queue::assertNothingPushed();
    }

    public function test_it_does_not_block_when_ol_enqueue_fails(): void
    {
        $this->setFeatureFlag('integrations.zoho-calendar-sync', true);
        config()->set('queue.default', 'sync');

        Http::fake(function ($request) {
            if (
                $request->url() ===
                'https://ol.test/v1/crm/events/zoho' &&
                $request->method() === 'POST'
            ) {
                return Http::response(['success' => false], 500);
            }

            return Http::response([], 404);
        });

        config()->set('services.ol.base_url', 'https://ol.test/v1');
        config()->set('services.ol.api_key', 'ol-test-key');
        config()->set('services.ol.timeout', 5);

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

        $followUp->refresh();
        $this->assertNull($followUp->zoho_calendar_job_id);
        $this->assertEquals(
            DealFollowUp::ZOHO_CALENDAR_SYNC_FAILED,
            $followUp->zoho_calendar_sync_status,
        );
    }
}
