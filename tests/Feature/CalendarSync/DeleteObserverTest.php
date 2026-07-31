<?php

namespace Tests\Feature\CalendarSync;

use App\Jobs\DeleteCalendarSyncEventJob;
use App\Models\DealFollowUp;
use App\Models\User;
use App\Observers\DealFollowUpObserver;
use App\Services\CalendarSyncService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Tests\Concerns\SetsFeatureFlags;
use Tests\TestCase;

class DeleteObserverTest extends TestCase
{
    use RefreshDatabase;
    use SetsFeatureFlags;

    public function test_it_dispatches_delete_job_when_event_uid_present(): void
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
        $followUp->zoho_calendar_event_uid = 'zoho-event-uid-1';
        $followUp->zoho_calendar_sync_status = DealFollowUp::ZOHO_CALENDAR_SYNC_SYNCED;
        $followUp->save();

        $observer = app(DealFollowUpObserver::class);
        $observer->deleted($followUp);

        Queue::assertPushed(DeleteCalendarSyncEventJob::class, function (DeleteCalendarSyncEventJob $job) {
            // Inspect via handle with faked HTTP would also work; assert class push is enough here.
            return true;
        });
    }

    public function test_it_skips_delete_when_no_event_uid(): void
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
        $followUp->zoho_calendar_event_uid = null;
        $followUp->save();

        $observer = app(DealFollowUpObserver::class);
        $observer->deleted($followUp);

        Queue::assertNothingPushed();
    }

    public function test_delete_job_calls_ol_delete_endpoint(): void
    {
        config()->set('services.ol.base_url', 'https://ol.test/v1');
        config()->set('services.ol.api_key', 'ol-test-key');
        config()->set('services.ol.timeout', 5);

        Http::fake(function ($request) {
            if (
                $request->url() ===
                    'https://ol.test/v1/crm/events/zoho-event-uid-1' &&
                $request->method() === 'DELETE'
            ) {
                return Http::response(null, 204);
            }

            return Http::response([], 404);
        });

        $job = new DeleteCalendarSyncEventJob('zoho-event-uid-1', 42, 99);
        $job->handle(app(CalendarSyncService::class));

        Http::assertSent(function ($request) {
            return $request->url() === 'https://ol.test/v1/crm/events/zoho-event-uid-1'
                && $request->method() === 'DELETE'
                && ($request['creatorUserId'] ?? null) == 42;
        });
    }
}
