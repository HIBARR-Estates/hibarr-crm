<?php

namespace Tests\Feature\CalendarSync;

use App\Models\DealFollowUp;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\Concerns\SetsFeatureFlags;
use Tests\TestCase;

class RetryEndpointTest extends TestCase
{
    use RefreshDatabase;
    use SetsFeatureFlags;

    public function test_it_blocks_non_creator_retries(): void
    {
        $this->setFeatureFlag('integrations.zoho-calendar-sync', true);

        $creator = User::factory()->create();
        $otherUser = User::factory()->create();

        $followUp = new DealFollowUp();
        $followUp->added_by = $creator->id;
        $followUp->next_follow_up_date = now();
        $followUp->duration = 30;
        $followUp->location = 'office';
        $followUp->meeting_link = '';
        $followUp->status = 'scheduled';
        $followUp->participants = [];
        $followUp->zoho_calendar_job_id = null;
        $followUp->zoho_calendar_sync_status = DealFollowUp::ZOHO_CALENDAR_SYNC_FAILED;
        $followUp->save();

        $this->actingAs($otherUser);

        $this->post(route('calendar_sync.retry', ['followUp' => $followUp->id]))
            ->assertStatus(403);
    }

    public function test_it_retries_with_fresh_enqueue_when_job_id_is_null(): void
    {
        config()->set('services.ol.base_url', 'https://ol.test/v1');
        config()->set('services.ol.api_key', 'ol-test-key');
        config()->set('services.ol.timeout', 5);

        $this->setFeatureFlag('integrations.zoho-calendar-sync', true);

        $creator = User::factory()->create();

        $followUp = new DealFollowUp();
        $followUp->added_by = $creator->id;
        $followUp->next_follow_up_date = now();
        $followUp->duration = 30;
        $followUp->remark = 'Test description';
        $followUp->location = 'office';
        $followUp->meeting_link = '';
        $followUp->status = 'scheduled';
        $followUp->participants = [];
        $followUp->zoho_calendar_job_id = null;
        $followUp->zoho_calendar_sync_status = DealFollowUp::ZOHO_CALENDAR_SYNC_FAILED;
        $followUp->save();

        Http::fake(function ($request) {
            if (
                $request->url() ===
                'https://ol.test/v1/crm/events/zoho' &&
                $request->method() === 'POST'
            ) {
                return Http::response(
                    [
                        'success' => true,
                        'message' => 'Calendar event job enqueued',
                        'data' => ['jobId' => 'job-new'],
                    ],
                    202,
                );
            }

            return Http::response([], 404);
        });

        $this->actingAs($creator);

        $this->post(
            route('calendar_sync.retry', ['followUp' => $followUp->id]),
        )
            ->assertStatus(200)
            ->assertJsonPath('status', 'success');

        $followUp->refresh();

        $this->assertEquals('job-new', $followUp->zoho_calendar_job_id);
        $this->assertEquals(
            DealFollowUp::ZOHO_CALENDAR_SYNC_PENDING,
            $followUp->zoho_calendar_sync_status,
        );
    }

    public function test_it_retries_existing_job_id_via_ol_retry_endpoint(): void
    {
        config()->set('services.ol.base_url', 'https://ol.test/v1');
        config()->set('services.ol.api_key', 'ol-test-key');
        config()->set('services.ol.timeout', 5);

        $this->setFeatureFlag('integrations.zoho-calendar-sync', true);

        $creator = User::factory()->create();

        $followUp = new DealFollowUp();
        $followUp->added_by = $creator->id;
        $followUp->next_follow_up_date = now();
        $followUp->duration = 30;
        $followUp->remark = 'Test description';
        $followUp->location = 'office';
        $followUp->meeting_link = '';
        $followUp->status = 'scheduled';
        $followUp->participants = [];
        $followUp->zoho_calendar_job_id = 'job-old';
        $followUp->zoho_calendar_sync_status = DealFollowUp::ZOHO_CALENDAR_SYNC_FAILED;
        $followUp->save();

        Http::fake(function ($request) {
            if (
                $request->url() ===
                    'https://ol.test/v1/crm/events/jobs/job-old/retry' &&
                $request->method() === 'POST'
            ) {
                return Http::response(
                    [
                        'success' => true,
                        'message' => 'Calendar event job enqueued',
                        'data' => ['jobId' => 'job-new'],
                    ],
                    202,
                );
            }

            return Http::response([], 404);
        });

        $this->actingAs($creator);

        $this->post(
            route('calendar_sync.retry', ['followUp' => $followUp->id]),
        )
            ->assertStatus(200)
            ->assertJsonPath('status', 'success');

        $followUp->refresh();

        $this->assertEquals('job-new', $followUp->zoho_calendar_job_id);
        $this->assertEquals(
            DealFollowUp::ZOHO_CALENDAR_SYNC_PENDING,
            $followUp->zoho_calendar_sync_status,
        );
    }
}
