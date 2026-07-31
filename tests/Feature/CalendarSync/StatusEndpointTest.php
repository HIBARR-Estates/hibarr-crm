<?php

namespace Tests\Feature\CalendarSync;

use App\Models\DealFollowUp;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\Concerns\SetsFeatureFlags;
use Tests\TestCase;

class StatusEndpointTest extends TestCase
{
    use RefreshDatabase;
    use SetsFeatureFlags;

    private function makeFollowUp(User $creator, array $overrides = []): DealFollowUp
    {
        $followUp = new DealFollowUp();
        $followUp->added_by = $creator->id;
        $followUp->next_follow_up_date = now();
        $followUp->duration = 30;
        $followUp->location = 'office';
        $followUp->meeting_link = '';
        $followUp->status = 'scheduled';
        $followUp->participants = [];
        $followUp->zoho_calendar_job_id = 'job-abc';
        $followUp->zoho_calendar_sync_status = DealFollowUp::ZOHO_CALENDAR_SYNC_PENDING;
        foreach ($overrides as $key => $value) {
            $followUp->{$key} = $value;
        }
        $followUp->save();

        return $followUp;
    }

    public function test_it_persists_synced_and_event_uid_when_ol_completed(): void
    {
        config()->set('services.ol.base_url', 'https://ol.test/v1');
        config()->set('services.ol.api_key', 'ol-test-key');
        config()->set('services.ol.timeout', 5);

        $this->setFeatureFlag('integrations.zoho-calendar-sync', true);

        $creator = User::factory()->create();
        $followUp = $this->makeFollowUp($creator);

        Http::fake(function ($request) {
            if (
                $request->url() ===
                    'https://ol.test/v1/crm/events/jobs/job-abc/status' &&
                $request->method() === 'GET'
            ) {
                return Http::response(
                    [
                        'success' => true,
                        'message' => 'Calendar event job status fetched',
                        'data' => [
                            'jobId' => 'job-abc',
                            'meetingId' => '1',
                            'status' => 'completed',
                            'zohoEventId' => 'zoho-event-uid-1',
                            'error' => null,
                            'createdAt' => now()->toISOString(),
                            'updatedAt' => now()->toISOString(),
                        ],
                    ],
                    200,
                );
            }

            return Http::response([], 404);
        });

        $this->actingAs($creator);

        $this->get(route('calendar_sync.status', ['followUp' => $followUp->id]))
            ->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.syncStatus', DealFollowUp::ZOHO_CALENDAR_SYNC_SYNCED)
            ->assertJsonPath('data.eventUid', 'zoho-event-uid-1');

        $followUp->refresh();
        $this->assertEquals(DealFollowUp::ZOHO_CALENDAR_SYNC_SYNCED, $followUp->zoho_calendar_sync_status);
        $this->assertEquals('zoho-event-uid-1', $followUp->zoho_calendar_event_uid);
    }

    public function test_it_persists_failed_when_ol_status_is_failed(): void
    {
        config()->set('services.ol.base_url', 'https://ol.test/v1');
        config()->set('services.ol.api_key', 'ol-test-key');
        config()->set('services.ol.timeout', 5);

        $this->setFeatureFlag('integrations.zoho-calendar-sync', true);

        $creator = User::factory()->create();
        $followUp = $this->makeFollowUp($creator);

        Http::fake(function ($request) {
            if (
                $request->url() ===
                    'https://ol.test/v1/crm/events/jobs/job-abc/status' &&
                $request->method() === 'GET'
            ) {
                return Http::response(
                    [
                        'success' => true,
                        'message' => 'Calendar event job status fetched',
                        'data' => [
                            'jobId' => 'job-abc',
                            'meetingId' => '1',
                            'status' => 'failed',
                            'zohoEventId' => null,
                            'error' => ['code' => 'ZOHO_ERROR', 'message' => 'Boom'],
                            'createdAt' => now()->toISOString(),
                            'updatedAt' => now()->toISOString(),
                        ],
                    ],
                    200,
                );
            }

            return Http::response([], 404);
        });

        $this->actingAs($creator);

        $this->get(route('calendar_sync.status', ['followUp' => $followUp->id]))
            ->assertStatus(200)
            ->assertJsonPath('data.syncStatus', DealFollowUp::ZOHO_CALENDAR_SYNC_FAILED)
            ->assertJsonPath('data.error.code', 'ZOHO_ERROR');

        $followUp->refresh();
        $this->assertEquals(DealFollowUp::ZOHO_CALENDAR_SYNC_FAILED, $followUp->zoho_calendar_sync_status);
    }

    public function test_it_marks_failed_when_ol_returns_404(): void
    {
        config()->set('services.ol.base_url', 'https://ol.test/v1');
        config()->set('services.ol.api_key', 'ol-test-key');
        config()->set('services.ol.timeout', 5);

        $this->setFeatureFlag('integrations.zoho-calendar-sync', true);

        $creator = User::factory()->create();
        $followUp = $this->makeFollowUp($creator);

        Http::fake(function ($request) {
            if (
                $request->url() ===
                    'https://ol.test/v1/crm/events/jobs/job-abc/status' &&
                $request->method() === 'GET'
            ) {
                return Http::response(
                    ['message' => 'Not found', 'data' => ['error' => 'missing']],
                    404,
                );
            }

            return Http::response([], 500);
        });

        $this->actingAs($creator);

        $this->get(route('calendar_sync.status', ['followUp' => $followUp->id]))
            ->assertStatus(200)
            ->assertJsonPath('data.syncStatus', DealFollowUp::ZOHO_CALENDAR_SYNC_FAILED);

        $followUp->refresh();
        $this->assertEquals(DealFollowUp::ZOHO_CALENDAR_SYNC_FAILED, $followUp->zoho_calendar_sync_status);
    }

    public function test_it_keeps_pending_while_ol_processing(): void
    {
        config()->set('services.ol.base_url', 'https://ol.test/v1');
        config()->set('services.ol.api_key', 'ol-test-key');
        config()->set('services.ol.timeout', 5);

        $this->setFeatureFlag('integrations.zoho-calendar-sync', true);

        $creator = User::factory()->create();
        $followUp = $this->makeFollowUp($creator);

        Http::fake(function ($request) {
            if (
                $request->url() ===
                    'https://ol.test/v1/crm/events/jobs/job-abc/status' &&
                $request->method() === 'GET'
            ) {
                return Http::response(
                    [
                        'success' => true,
                        'message' => 'Calendar event job status fetched',
                        'data' => [
                            'jobId' => 'job-abc',
                            'meetingId' => '1',
                            'status' => 'processing',
                            'zohoEventId' => null,
                            'error' => null,
                            'createdAt' => now()->toISOString(),
                            'updatedAt' => now()->toISOString(),
                        ],
                    ],
                    200,
                );
            }

            return Http::response([], 404);
        });

        $this->actingAs($creator);

        $this->get(route('calendar_sync.status', ['followUp' => $followUp->id]))
            ->assertStatus(200)
            ->assertJsonPath('data.syncStatus', DealFollowUp::ZOHO_CALENDAR_SYNC_PENDING);

        $followUp->refresh();
        $this->assertEquals(DealFollowUp::ZOHO_CALENDAR_SYNC_PENDING, $followUp->zoho_calendar_sync_status);
    }
}
