<?php

namespace Tests\Feature\CalendarSync;

use App\Jobs\SyncCalendarEventJob;
use App\Models\Deal;
use App\Models\DealFollowUp;
use App\Models\Lead;
use App\Models\User;
use App\Services\CalendarSyncService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\Concerns\SetsFeatureFlags;
use Tests\TestCase;

class SyncJobTest extends TestCase
{
    use RefreshDatabase;
    use SetsFeatureFlags;

    public function test_it_stores_job_id_and_pending_status_on_ol_success(): void
    {
        config()->set('services.ol.base_url', 'https://ol.test/v1');
        config()->set('services.ol.api_key', 'ol-test-key');
        config()->set('services.ol.timeout', 5);

        $capturedPayload = [];

        $creator = User::factory()->create();
        $attendee = User::factory()->create(['email' => 'attendee@hibarr.de']);

        Http::fake(function ($request) use (&$capturedPayload) {
            if (
                $request->url() ===
                'https://ol.test/v1/crm/events/zoho' &&
                $request->method() === 'POST'
            ) {
                $capturedPayload = $request->data();

                return Http::response(
                    [
                        'success' => true,
                        'message' => 'Calendar event job enqueued',
                        'data' => ['jobId' => 'job-123'],
                    ],
                    202,
                );
            }

            return Http::response([], 404);
        });

        $followUp = new DealFollowUp;
        $followUp->added_by = $creator->id;
        $followUp->next_follow_up_date = now();
        $followUp->duration = 30;
        $followUp->remark = 'Test description';
        $followUp->location = 'zoom';
        $followUp->meeting_link = 'https://example.com/meet';
        $followUp->status = 'scheduled';
        $followUp->participants = [$attendee->id];
        $followUp->save();

        $job = new SyncCalendarEventJob($followUp->id);
        $job->handle(app(CalendarSyncService::class));

        $followUp->refresh();

        $this->assertContains('attendee@hibarr.de', $capturedPayload['attendeeEmails'] ?? []);
        $this->assertArrayNotHasKey('participantUserIds', $capturedPayload);
        $this->assertArrayNotHasKey('contact', $capturedPayload);
        $this->assertEquals('job-123', $followUp->zoho_calendar_job_id);
        $this->assertEquals(
            DealFollowUp::ZOHO_CALENDAR_SYNC_PENDING,
            $followUp->zoho_calendar_sync_status,
        );
    }

    public function test_it_sets_failed_status_when_ol_create_returns_404(): void
    {
        config()->set('services.ol.base_url', 'https://ol.test/v1');
        config()->set('services.ol.api_key', 'ol-test-key');
        config()->set('services.ol.timeout', 5);

        Http::fake(function ($request) {
            if (
                $request->url() ===
                'https://ol.test/v1/crm/events/zoho' &&
                $request->method() === 'POST'
            ) {
                return Http::response(
                    ['message' => 'No linked OL user', 'data' => ['error' => 'not_found']],
                    404,
                );
            }

            return Http::response([], 500);
        });

        $creator = User::factory()->create();
        $attendee = User::factory()->create();

        $followUp = new DealFollowUp;
        $followUp->added_by = $creator->id;
        $followUp->next_follow_up_date = now();
        $followUp->duration = 30;
        $followUp->remark = 'Test description';
        $followUp->location = 'zoom';
        $followUp->meeting_link = 'https://example.com/meet';
        $followUp->status = 'scheduled';
        $followUp->participants = [$attendee->id];
        $followUp->save();

        $job = new SyncCalendarEventJob($followUp->id);
        $job->handle(app(CalendarSyncService::class));

        $followUp->refresh();

        $this->assertNull($followUp->zoho_calendar_job_id);
        $this->assertEquals(
            DealFollowUp::ZOHO_CALENDAR_SYNC_FAILED,
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
                'https://ol.test/v1/crm/events/zoho' &&
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

        $followUp = new DealFollowUp;
        $followUp->added_by = $creator->id;
        $followUp->next_follow_up_date = now();
        $followUp->duration = 30;
        $followUp->remark = 'Test description';
        $followUp->location = 'zoom';
        $followUp->meeting_link = 'https://example.com/meet';
        $followUp->status = 'scheduled';
        $followUp->participants = [$attendee->id];
        $followUp->save();

        $job = new SyncCalendarEventJob($followUp->id);
        $job->handle(app(CalendarSyncService::class));

        $followUp->refresh();

        $this->assertNull($followUp->zoho_calendar_job_id);
        $this->assertEquals(
            DealFollowUp::ZOHO_CALENDAR_SYNC_FAILED,
            $followUp->zoho_calendar_sync_status,
        );
    }

    public function test_it_sends_host_id_as_the_zoho_organizer_not_the_creator(): void
    {
        $this->setFeatureFlag('crm.meeting-host', true);

        config()->set('services.ol.base_url', 'https://ol.test/v1');
        config()->set('services.ol.api_key', 'ol-test-key');
        config()->set('services.ol.timeout', 5);

        $capturedPayload = [];

        Http::fake(function ($request) use (&$capturedPayload) {
            if (
                $request->url() ===
                'https://ol.test/v1/crm/events/zoho' &&
                $request->method() === 'POST'
            ) {
                $capturedPayload = $request->data();

                return Http::response(
                    [
                        'success' => true,
                        'message' => 'Calendar event job enqueued',
                        'data' => ['jobId' => 'job-host-123'],
                    ],
                    202,
                );
            }

            return Http::response([], 404);
        });

        $creator = User::factory()->create();
        $host = User::factory()->create();

        $followUp = new DealFollowUp;
        $followUp->added_by = $creator->id;
        $followUp->host_id = $host->id;
        $followUp->next_follow_up_date = now();
        $followUp->duration = 30;
        $followUp->remark = 'Test description';
        $followUp->location = 'zoom';
        $followUp->meeting_link = 'https://example.com/meet';
        $followUp->status = 'scheduled';
        $followUp->participants = [$creator->id];
        $followUp->save();

        $job = new SyncCalendarEventJob($followUp->id);
        $job->handle(app(CalendarSyncService::class));

        $this->assertEquals($host->id, $capturedPayload['creatorUserId'] ?? null);
    }

    public function test_it_includes_lead_email_in_attendee_emails_for_deal_meeting(): void
    {
        config()->set('services.ol.base_url', 'https://ol.test/v1');
        config()->set('services.ol.api_key', 'ol-test-key');
        config()->set('services.ol.timeout', 5);

        $capturedPayload = [];

        Http::fake(function ($request) use (&$capturedPayload) {
            if (
                $request->url() ===
                'https://ol.test/v1/crm/events/zoho' &&
                $request->method() === 'POST'
            ) {
                $capturedPayload = $request->data();

                return Http::response(
                    [
                        'success' => true,
                        'message' => 'Calendar event job enqueued',
                        'data' => ['jobId' => 'job-lead-123'],
                    ],
                    202,
                );
            }

            return Http::response([], 404);
        });

        $companyId = 1;
        $creator = User::factory()->create(['company_id' => $companyId]);
        $lead = Lead::factory()->create([
            'company_id' => $companyId,
            'client_email' => 'lead@example.com',
            'client_name' => 'Lead Person',
        ]);
        $deal = Deal::factory()->create([
            'company_id' => $companyId,
            'lead_id' => $lead->id,
            'client_email' => 'lead@example.com',
            'client_name' => 'Lead Person',
        ]);

        $followUp = new DealFollowUp;
        $followUp->added_by = $creator->id;
        $followUp->deal_id = $deal->id;
        $followUp->next_follow_up_date = now();
        $followUp->duration = 30;
        $followUp->remark = 'Test description';
        $followUp->location = 'zoom';
        $followUp->meeting_link = 'https://example.com/meet';
        $followUp->status = 'scheduled';
        $followUp->participants = [$creator->id];
        $followUp->save();

        $job = new SyncCalendarEventJob($followUp->id);
        $job->handle(app(CalendarSyncService::class));

        $this->assertContains('lead@example.com', $capturedPayload['attendeeEmails'] ?? []);
        $this->assertArrayNotHasKey('guestEmails', $capturedPayload);
        $this->assertArrayNotHasKey('contactEmail', $capturedPayload);
    }
}
