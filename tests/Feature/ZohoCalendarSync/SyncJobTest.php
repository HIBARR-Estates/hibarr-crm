<?php

namespace Tests\Feature\ZohoCalendarSync;

use App\Jobs\SyncZohoCalendarEventJob;
use App\Models\DealFollowUp;
use App\Models\User;
use App\Services\ZohoCalendarSyncService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class SyncJobTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_stores_job_id_and_pending_status_on_ol_success(): void
    {
        config()->set('services.ol.base_url', 'https://ol.test/v1');
        config()->set('services.ol.api_key', 'ol-test-key');
        config()->set('services.ol.timeout', 5);

        Http::fake(function ($request) {
            if (
                $request->url() ===
                'https://ol.test/v1/integrations/zoho/calendar/events' &&
                $request->method() === 'POST'
            ) {
                return Http::response(
                    [
                        'success' => true,
                        'message' => 'Zoho calendar event job enqueued',
                        'data' => ['jobId' => 'job-123'],
                    ],
                    200,
                );
            }

            return Http::response([], 404);
        });

        $creator = User::factory()->create();
        $attendee = User::factory()->create();

        $followUp = new DealFollowUp();
        $followUp->added_by = $creator->id;
        $followUp->next_follow_up_date = now();
        $followUp->duration = 30;
        $followUp->remark = 'Test description';
        $followUp->location = 'zoom';
        $followUp->meeting_link = 'https://example.com/meet';
        $followUp->status = 'scheduled';
        $followUp->participants = [$attendee->id];
        $followUp->save();

        $job = new SyncZohoCalendarEventJob($followUp->id);
        $job->handle(app(ZohoCalendarSyncService::class));

        $followUp->refresh();

        $this->assertEquals('job-123', $followUp->zoho_calendar_job_id);
        $this->assertEquals(
            DealFollowUp::ZOHO_CALENDAR_SYNC_PENDING,
            $followUp->zoho_calendar_sync_status,
        );
    }

    public function test_it_sets_failed_status_when_ol_create_returns_non_2xx(): void
    {
        config()->set('services.ol.base_url', 'https://ol.test/v1');
        config()->set('services.ol.api_key', 'ol-test-key');
        config()->set('services.ol.timeout', 5);

        Http::fake(function ($request) {
            if (
                $request->url() ===
                'https://ol.test/v1/integrations/zoho/calendar/events' &&
                $request->method() === 'POST'
            ) {
                return Http::response(
                    ['success' => false, 'message' => 'Boom'],
                    500,
                );
            }

            return Http::response([], 404);
        });

        $creator = User::factory()->create();
        $attendee = User::factory()->create();

        $followUp = new DealFollowUp();
        $followUp->added_by = $creator->id;
        $followUp->next_follow_up_date = now();
        $followUp->duration = 30;
        $followUp->remark = 'Test description';
        $followUp->location = 'zoom';
        $followUp->meeting_link = 'https://example.com/meet';
        $followUp->status = 'scheduled';
        $followUp->participants = [$attendee->id];
        $followUp->save();

        $job = new SyncZohoCalendarEventJob($followUp->id);
        $job->handle(app(ZohoCalendarSyncService::class));

        $followUp->refresh();

        $this->assertNull($followUp->zoho_calendar_job_id);
        $this->assertEquals(
            DealFollowUp::ZOHO_CALENDAR_SYNC_FAILED,
            $followUp->zoho_calendar_sync_status,
        );
    }
}

