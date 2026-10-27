<?php

namespace Tests\Feature\ApiV2;

use App\Models\ApiToken;
use App\Models\SallyMeetingInsight;
use App\Services\ApiV2\CrmWriteService;
use App\Services\FeatureFlagService;
use App\Services\SallyMeetingInsightService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class CrmWriteSallyMeetingApiTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->ensureApiTokensTable();
        $this->ensureCrmWriteSallyTables();

        app(FeatureFlagService::class)->setTestingOverrides([
            'sally.crm-write-client' => true,
        ]);
    }

    protected function tearDown(): void
    {
        app(FeatureFlagService::class)->clearTestingOverrides();

        parent::tearDown();
    }

    public function test_upsert_sally_meeting_insight_creates_and_updates(): void
    {
        $companyId = 1;
        $leadId = DB::table('leads')->insertGetId([
            'company_id' => $companyId,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $dealId = DB::table('deals')->insertGetId([
            'company_id' => $companyId,
            'lead_id' => $leadId,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $meetingId = DB::table('lead_follow_up')->insertGetId([
            'lead_id' => $leadId,
            'deal_id' => $dealId,
            'remark' => 'Discovery call',
            'location' => 'zoom',
            'next_follow_up_date' => now()->addDay(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->insertApiToken('test-crm-write-token', companyId: $companyId);

        $headers = [
            'X-API-TOKEN' => 'test-crm-write-token',
            'X-COMPANY-ID' => (string) $companyId,
        ];

        $create = $this->postJson('/api/v2/sally-meetings', [
            'meeting_id' => $meetingId,
            'lead_id' => $leadId,
            'deal_id' => $dealId,
            'summary' => 'Client wants a sea-view villa.',
            'bullet_points' => ['Budget 800k', 'Move in Q2'],
            'transcript' => [
                [
                    'id' => 'a2b13b49-10e7-44be-bbb1-db568406af42',
                    'text' => 'Hello',
                    'speakerName' => 'Agent',
                    'startTime' => 1.0,
                    'endTime' => 2.5,
                    'sortOrder' => 0,
                ],
            ],
        ], $headers);

        $create->assertCreated()
            ->assertJsonPath('data.meeting_id', $meetingId)
            ->assertJsonPath('data.summary', 'Client wants a sea-view villa.')
            ->assertJsonPath('data.payload.summary', 'Client wants a sea-view villa.')
            ->assertJsonPath('data.transcript', 'Agent: Hello')
            ->assertJsonPath('data.payload.transcript', 'Agent: Hello')
            ->assertJsonPath('data.transcript_segments.0.speakerName', 'Agent');

        $this->assertDatabaseHas('sally_meeting_insights', [
            'meeting_follow_up_id' => $meetingId,
            'deal_id' => $dealId,
            'lead_id' => $leadId,
            'transcript' => 'Agent: Hello',
        ]);

        $update = $this->postJson('/api/v2/sally-meetings', [
            'meeting_id' => $meetingId,
            'lead_id' => $leadId,
            'deal_id' => $dealId,
            'summary' => 'Updated summary',
        ], $headers);

        $update->assertOk()
            ->assertJsonPath('data.summary', 'Updated summary');

        $this->assertSame(1, SallyMeetingInsight::withoutGlobalScopes()->count());
    }

    public function test_upsert_strips_dangerous_markup_from_the_stored_summary(): void
    {
        $companyId = 1;
        $leadId = DB::table('leads')->insertGetId([
            'company_id' => $companyId,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $meetingId = DB::table('lead_follow_up')->insertGetId([
            'lead_id' => $leadId,
            'remark' => 'Call',
            'location' => 'zoom',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->insertApiToken('test-crm-write-token', companyId: $companyId);

        // This endpoint takes content from an external system, so the summary
        // must be purified on write — not only on the two edit routes.
        app(CrmWriteService::class)->upsertSallyMeetingInsight($companyId, [
            'meeting_id' => $meetingId,
            'summary' => '<p>Client wants a villa.</p>'
                .'<script>alert(1)</script>'
                .'<img src=x onerror=alert(2)>'
                .'<iframe src="https://evil.test"></iframe>'
                .'<a href="javascript:alert(3)">bad link</a>',
        ]);

        $stored = (string) DB::table('sally_meeting_insights')
            ->where('meeting_follow_up_id', $meetingId)
            ->value('summary');

        $this->assertStringContainsString('<p>Client wants a villa.</p>', $stored);
        $this->assertStringNotContainsString('<script', $stored);
        $this->assertStringNotContainsString('<img', $stored);
        $this->assertStringNotContainsString('<iframe', $stored);
        $this->assertStringNotContainsString('javascript:', $stored);
        $this->assertStringNotContainsString('onerror', $stored);
    }

    public function test_api_posted_summary_never_stores_executable_markup(): void
    {
        $companyId = 1;
        $leadId = DB::table('leads')->insertGetId([
            'company_id' => $companyId,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $meetingId = DB::table('lead_follow_up')->insertGetId([
            'lead_id' => $leadId,
            'remark' => 'Call',
            'location' => 'zoom',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->insertApiToken('test-crm-write-token', companyId: $companyId);

        // Over HTTP the global XSS middleware strip_tags the body, so this
        // arrives as inert text. The row must hold no markup at all.
        $this->postJson('/api/v2/sally-meetings', [
            'meeting_id' => $meetingId,
            'summary' => '<script>alert(1)</script><img src=x onerror=alert(2)>',
        ], [
            'X-API-TOKEN' => 'test-crm-write-token',
            'X-COMPANY-ID' => (string) $companyId,
        ])->assertCreated();

        $stored = (string) DB::table('sally_meeting_insights')
            ->where('meeting_follow_up_id', $meetingId)
            ->value('summary');

        $this->assertDoesNotMatchRegularExpression('/<[a-z\/!?]/i', $stored);
    }

    public function test_get_sally_meeting_insight_by_meeting_id(): void
    {
        $companyId = 1;
        $leadId = DB::table('leads')->insertGetId([
            'company_id' => $companyId,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $dealId = DB::table('deals')->insertGetId([
            'company_id' => $companyId,
            'lead_id' => $leadId,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $meetingId = DB::table('lead_follow_up')->insertGetId([
            'lead_id' => $leadId,
            'deal_id' => $dealId,
            'remark' => 'Call',
            'location' => 'zoom',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        app(CrmWriteService::class)->upsertSallyMeetingInsight($companyId, [
            'meeting_id' => $meetingId,
            'lead_id' => $leadId,
            'deal_id' => $dealId,
            'summary' => 'Readable summary',
        ]);

        $this->insertApiToken('test-crm-write-token', companyId: $companyId);
        $headers = [
            'X-API-TOKEN' => 'test-crm-write-token',
            'X-COMPANY-ID' => (string) $companyId,
        ];

        $this->getJson("/api/v2/sally-meetings/{$meetingId}", $headers)
            ->assertOk()
            ->assertJsonPath('data.meeting_id', $meetingId)
            ->assertJsonPath('data.summary', 'Readable summary')
            ->assertJsonPath('data.payload.summary', 'Readable summary');

        $this->getJson('/api/v2/sally-meetings?deal_id='.$dealId, $headers)
            ->assertOk()
            ->assertJsonPath('data.0.meeting_id', $meetingId);
    }

    public function test_upsert_accepts_summary_inside_payload_wrapper(): void
    {
        $companyId = 1;
        $leadId = DB::table('leads')->insertGetId([
            'company_id' => $companyId,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $dealId = DB::table('deals')->insertGetId([
            'company_id' => $companyId,
            'lead_id' => $leadId,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $meetingId = DB::table('lead_follow_up')->insertGetId([
            'lead_id' => $leadId,
            'deal_id' => $dealId,
            'remark' => 'Call',
            'location' => 'zoom',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->insertApiToken('test-crm-write-token', companyId: $companyId);

        $response = $this->postJson('/api/v2/sally-meetings', [
            'meeting_id' => $meetingId,
            'lead_id' => $leadId,
            'deal_id' => $dealId,
            'payload' => [
                'summary' => 'Wrapped summary from Sally',
                'bullet_points' => ['Point A'],
            ],
        ], [
            'X-API-TOKEN' => 'test-crm-write-token',
            'X-COMPANY-ID' => (string) $companyId,
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.summary', 'Wrapped summary from Sally')
            ->assertJsonPath('data.payload.summary', 'Wrapped summary from Sally');
    }

    public function test_upsert_backfills_lead_from_deal_when_meeting_has_no_lead(): void
    {
        $companyId = 1;
        $leadId = DB::table('leads')->insertGetId([
            'company_id' => $companyId,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $dealId = DB::table('deals')->insertGetId([
            'company_id' => $companyId,
            'lead_id' => $leadId,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        // A meeting created from the Deals workspace carries only deal_id.
        $meetingId = DB::table('lead_follow_up')->insertGetId([
            'deal_id' => $dealId,
            'remark' => 'Deal call',
            'location' => 'zoom',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->insertApiToken('test-crm-write-token', companyId: $companyId);

        $response = $this->postJson('/api/v2/sally-meetings', [
            'meeting_id' => $meetingId,
            'summary' => 'Deal-scoped summary',
        ], [
            'X-API-TOKEN' => 'test-crm-write-token',
            'X-COMPANY-ID' => (string) $companyId,
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.lead_id', $leadId)
            ->assertJsonPath('data.deal_id', $dealId);
    }

    public function test_upsert_rejects_a_meeting_owned_by_another_company(): void
    {
        $companyId = 1;
        $otherCompanyId = 2;
        $otherLeadId = DB::table('leads')->insertGetId([
            'company_id' => $otherCompanyId,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $otherDealId = DB::table('deals')->insertGetId([
            'company_id' => $otherCompanyId,
            'lead_id' => $otherLeadId,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $otherMeetingId = DB::table('lead_follow_up')->insertGetId([
            'lead_id' => $otherLeadId,
            'deal_id' => $otherDealId,
            'remark' => 'Other tenant call',
            'location' => 'zoom',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->insertApiToken('test-crm-write-token', companyId: $companyId);

        $this->postJson('/api/v2/sally-meetings', [
            'meeting_id' => $otherMeetingId,
            'summary' => 'Should not be stored',
        ], [
            'X-API-TOKEN' => 'test-crm-write-token',
            'X-COMPANY-ID' => (string) $companyId,
        ])->assertStatus(422);

        $this->assertDatabaseCount('sally_meeting_insights', 0);
    }

    public function test_upsert_does_not_overwrite_another_tenants_insight(): void
    {
        $companyId = 1;
        $otherCompanyId = 2;

        $leadId = DB::table('leads')->insertGetId([
            'company_id' => $companyId,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $meetingId = DB::table('lead_follow_up')->insertGetId([
            'lead_id' => $leadId,
            'remark' => 'Call',
            'location' => 'zoom',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // An insight for the same meeting, owned by a different tenant.
        DB::table('sally_meeting_insights')->insert([
            'company_id' => $otherCompanyId,
            'meeting_follow_up_id' => $meetingId,
            'summary' => 'Other tenant summary',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->insertApiToken('test-crm-write-token', companyId: $companyId);

        $this->postJson('/api/v2/sally-meetings', [
            'meeting_id' => $meetingId,
            'summary' => 'Overwrite attempt',
        ], [
            'X-API-TOKEN' => 'test-crm-write-token',
            'X-COMPANY-ID' => (string) $companyId,
        ])->assertStatus(422);

        $this->assertDatabaseCount('sally_meeting_insights', 1);
        $this->assertDatabaseHas('sally_meeting_insights', [
            'company_id' => $otherCompanyId,
            'summary' => 'Other tenant summary',
        ]);
    }

    public function test_upsert_service_persists_insight(): void
    {
        $companyId = 1;
        $leadId = DB::table('leads')->insertGetId([
            'company_id' => $companyId,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $dealId = DB::table('deals')->insertGetId([
            'company_id' => $companyId,
            'lead_id' => $leadId,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $meetingId = DB::table('lead_follow_up')->insertGetId([
            'lead_id' => $leadId,
            'deal_id' => $dealId,
            'remark' => 'Call',
            'location' => 'zoom',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $result = app(CrmWriteService::class)->upsertSallyMeetingInsight($companyId, [
            'meeting_id' => $meetingId,
            'lead_id' => $leadId,
            'deal_id' => $dealId,
            'summary' => 'Hello',
            'bullet_points' => ['One'],
        ]);

        $payload = app(SallyMeetingInsightService::class)->serialize($result['insight']);

        $this->assertTrue($result['created']);
        $this->assertSame('Hello', $payload['summary']);
    }

    /**
     * @return array{company: int, lead: int, deal: int, meeting: int, headers: array<string, string>}
     */
    private function makeMeetingFixture(?int $companyId = 1): array
    {
        $leadId = DB::table('leads')->insertGetId([
            'company_id' => $companyId,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $dealId = DB::table('deals')->insertGetId([
            'company_id' => $companyId,
            'lead_id' => $leadId,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $meetingId = DB::table('lead_follow_up')->insertGetId([
            'lead_id' => $leadId,
            'deal_id' => $dealId,
            'remark' => 'Call',
            'location' => 'zoom',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->insertApiToken('test-crm-write-token', companyId: $companyId);

        return [
            'company' => $companyId,
            'lead' => $leadId,
            'deal' => $dealId,
            'meeting' => $meetingId,
            'headers' => [
                'X-API-TOKEN' => 'test-crm-write-token',
                'X-COMPANY-ID' => (string) $companyId,
            ],
        ];
    }

    public function test_upsert_stores_recording_url_and_suggested_notes(): void
    {
        $fixture = $this->makeMeetingFixture();

        $response = $this->postJson('/api/v2/sally-meetings', [
            'meeting_id' => $fixture['meeting'],
            'lead_id' => $fixture['lead'],
            'deal_id' => $fixture['deal'],
            'summary' => 'Fee is **1,400**.',
            'payload' => [
                'recording_url' => 'https://sally.example/recordings/abc',
                'suggested_notes' => [
                    ['id' => 'obj-1', 'type' => 'objection', 'text' => 'Deposit is too high'],
                    ['id' => 'dec-1', 'type' => 'decision', 'text' => 'Confirm unit on Friday'],
                ],
            ],
        ], $fixture['headers']);

        $response->assertCreated()
            ->assertJsonPath('data.recording_url', 'https://sally.example/recordings/abc')
            ->assertJsonPath('data.suggested_notes.0.id', 'obj-1')
            ->assertJsonPath('data.suggested_notes.0.type', 'objection')
            ->assertJsonPath('data.suggested_notes.0.logged', false)
            ->assertJsonPath('data.suggested_notes.0.edited', false)
            ->assertJsonPath('data.suggested_notes.1.type', 'decision');

        $row = DB::table('sally_meeting_insights')
            ->where('meeting_follow_up_id', $fixture['meeting'])
            ->first();

        // Sally's originals are stored alongside the working copies.
        $this->assertSame('Fee is **1,400**.', $row->original_summary);
        $original = json_decode((string) $row->original_suggested_notes, true);
        $this->assertSame('Deposit is too high', $original[0]['text']);
        $working = json_decode((string) $row->suggested_notes, true);
        $this->assertFalse($working[0]['edited']);
        $this->assertNull($row->summary_edited_at);
    }

    public function test_resync_does_not_overwrite_agent_edits(): void
    {
        $fixture = $this->makeMeetingFixture();

        $this->postJson('/api/v2/sally-meetings', [
            'meeting_id' => $fixture['meeting'],
            'lead_id' => $fixture['lead'],
            'summary' => 'Sally version',
            'bullet_points' => ['Sally bullet'],
            'suggested_notes' => [
                ['id' => 'obj-1', 'type' => 'objection', 'text' => 'Sally text'],
            ],
        ], $fixture['headers'])->assertCreated();

        // The agent corrects the summary and the bullets on the card.
        DB::table('sally_meeting_insights')
            ->where('meeting_follow_up_id', $fixture['meeting'])
            ->update([
                'summary' => 'Agent version',
                'summary_edited_at' => now(),
                'bullet_points' => json_encode(['Agent bullet']),
                'bullet_points_edited_at' => now(),
                'suggested_notes' => json_encode([
                    ['id' => 'obj-1', 'type' => 'objection', 'text' => 'Agent text', 'edited' => true],
                ]),
            ]);

        // OL re-syncs with everything it has — the CRM must ignore the
        // fields the agent touched.
        $this->postJson('/api/v2/sally-meetings', [
            'meeting_id' => $fixture['meeting'],
            'lead_id' => $fixture['lead'],
            'summary' => 'Sally rewrite',
            'bullet_points' => ['Sally bullet 2'],
            'suggested_notes' => [
                ['id' => 'obj-1', 'type' => 'objection', 'text' => 'Sally rewrite'],
            ],
        ], $fixture['headers'])->assertOk();

        $row = DB::table('sally_meeting_insights')
            ->where('meeting_follow_up_id', $fixture['meeting'])
            ->first();

        $this->assertSame('Agent version', $row->summary);
        $this->assertNotNull($row->summary_edited_at);
        $this->assertSame(['Agent bullet'], json_decode((string) $row->bullet_points, true));
        $this->assertSame(
            'Sally version',
            $row->original_summary,
            "Sally's original stays as first received.",
        );
        $this->assertSame('Agent text', json_decode((string) $row->suggested_notes, true)[0]['text']);
    }

    public function test_resync_does_not_unlog_logged_suggestions(): void
    {
        $fixture = $this->makeMeetingFixture();

        $this->postJson('/api/v2/sally-meetings', [
            'meeting_id' => $fixture['meeting'],
            'lead_id' => $fixture['lead'],
            'suggested_notes' => [
                ['id' => 'obj-1', 'type' => 'objection', 'text' => 'Logged one'],
                ['id' => 'dec-1', 'type' => 'decision', 'text' => 'Untouched one'],
            ],
        ], $fixture['headers'])->assertCreated();

        $insightId = DB::table('sally_meeting_insights')
            ->where('meeting_follow_up_id', $fixture['meeting'])
            ->value('id');

        // The agent logs the objection as a note.
        DB::table('sally_suggestion_logs')->insert([
            'company_id' => $fixture['company'],
            'sally_meeting_insight_id' => $insightId,
            'suggestion_id' => 'obj-1',
            'note_id' => 99,
            'logged_mode' => 'as_is',
            'logged_text' => 'Logged one',
            'logged_by' => 1,
            'logged_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Re-sync: Sally rewrote both texts and added a new suggestion.
        $response = $this->postJson('/api/v2/sally-meetings', [
            'meeting_id' => $fixture['meeting'],
            'lead_id' => $fixture['lead'],
            'suggested_notes' => [
                ['id' => 'obj-1', 'type' => 'objection', 'text' => 'Sally rewrite'],
                ['id' => 'dec-1', 'type' => 'decision', 'text' => 'Refreshed text'],
                ['id' => 'ins-1', 'type' => 'insight', 'text' => 'New one'],
            ],
        ], $fixture['headers'])->assertOk();

        $suggestions = collect($response->json('data.suggested_notes'))->keyBy('id');

        $this->assertTrue($suggestions['obj-1']['logged']);
        $this->assertSame('Logged one', $suggestions['obj-1']['text'], 'A logged suggestion keeps its logged text.');
        $this->assertSame(99, $suggestions['obj-1']['logged_note_id']);
        $this->assertFalse($suggestions['dec-1']['logged']);
        $this->assertSame('Refreshed text', $suggestions['dec-1']['text']);
        $this->assertFalse($suggestions['ins-1']['logged']);
        $this->assertSame('New one', $suggestions['ins-1']['text']);
        $this->assertCount(3, $suggestions);

        $this->assertSame(
            1,
            DB::table('sally_suggestion_logs')->where('sally_meeting_insight_id', $insightId)->count(),
        );
    }

    public function test_recording_url_must_be_http(): void
    {
        $fixture = $this->makeMeetingFixture();

        $response = $this->postJson('/api/v2/sally-meetings', [
            'meeting_id' => $fixture['meeting'],
            'lead_id' => $fixture['lead'],
            'recording_url' => 'javascript:alert(1)//sally.example',
        ], $fixture['headers']);

        $response->assertCreated()->assertJsonPath('data.recording_url', null);
    }

    public function test_upsert_rejects_unknown_suggestion_type(): void
    {
        $fixture = $this->makeMeetingFixture();

        $response = $this->postJson('/api/v2/sally-meetings', [
            'meeting_id' => $fixture['meeting'],
            'lead_id' => $fixture['lead'],
            'summary' => 'Some summary',
            'suggested_notes' => [
                ['id' => 'x-1', 'type' => 'worry', 'text' => 'Not a known type'],
            ],
        ], $fixture['headers'])->assertStatus(422);

        // ApiV2 renders validation errors under error.details (see
        // Handler/api middleware), not Laravel's flat errors body.
        $details = $response->json('error.details') ?? [];
        $this->assertArrayHasKey('suggested_notes.0.type', $details);

        // Duplicate ids inside one payload are rejected too — they would
        // break the logged/unlogged bookkeeping.
        $response = $this->postJson('/api/v2/sally-meetings', [
            'meeting_id' => $fixture['meeting'],
            'lead_id' => $fixture['lead'],
            'summary' => 'Some summary',
            'suggested_notes' => [
                ['id' => 'x-1', 'type' => 'insight', 'text' => 'One'],
                ['id' => 'x-1', 'type' => 'insight', 'text' => 'Two'],
            ],
        ], $fixture['headers'])->assertStatus(422);

        $details = $response->json('error.details') ?? [];
        $this->assertArrayHasKey('suggested_notes.1.id', $details);
    }

    private function ensureApiTokensTable(): void
    {
        if (Schema::hasTable('api_tokens')) {
            return;
        }

        Schema::create('api_tokens', function (Blueprint $table) {
            $table->id();
            $table->string('token', 64)->unique();
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name');
            $table->json('permissions')->nullable();
            $table->boolean('unrestricted')->default(false);
            $table->boolean('revoked')->default(false);
            $table->timestamps();
        });
    }

    private function ensureCrmWriteSallyTables(): void
    {
        if (! Schema::hasTable('leads')) {
            Schema::create('leads', function (Blueprint $table) {
                $table->id();
                $table->unsignedInteger('company_id')->nullable();
                $table->timestamps();
                $table->softDeletes();
            });
        }

        if (! Schema::hasTable('deals')) {
            Schema::create('deals', function (Blueprint $table) {
                $table->id();
                $table->unsignedInteger('company_id')->nullable();
                $table->unsignedInteger('lead_id')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('lead_follow_up')) {
            Schema::create('lead_follow_up', function (Blueprint $table) {
                $table->id();
                $table->unsignedInteger('deal_id')->nullable();
                $table->unsignedInteger('lead_id')->nullable();
                $table->text('remark')->nullable();
                $table->string('location')->nullable();
                $table->timestamp('next_follow_up_date')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('sally_meeting_insights')) {
            Schema::create('sally_meeting_insights', function (Blueprint $table) {
                $table->id();
                $table->unsignedInteger('company_id');
                $table->unsignedInteger('meeting_follow_up_id')->unique();
                $table->unsignedInteger('lead_id')->nullable();
                $table->unsignedInteger('deal_id')->nullable();
                $table->text('summary')->nullable();
                $table->longText('transcript')->nullable();
                $table->json('transcript_segments')->nullable();
                $table->json('bullet_points')->nullable();
                $table->text('recording_url')->nullable();
                $table->text('original_summary')->nullable();
                $table->json('original_bullet_points')->nullable();
                $table->json('suggested_notes')->nullable();
                $table->json('original_suggested_notes')->nullable();
                $table->timestamp('summary_edited_at')->nullable();
                $table->timestamp('bullet_points_edited_at')->nullable();
                $table->timestamps();
            });

            Schema::create('sally_suggestion_logs', function (Blueprint $table) {
                $table->id();
                $table->unsignedInteger('company_id');
                $table->unsignedInteger('sally_meeting_insight_id');
                $table->string('suggestion_id', 64);
                $table->unsignedInteger('lead_id')->nullable();
                $table->unsignedBigInteger('deal_id')->nullable();
                $table->unsignedInteger('note_id');
                $table->string('logged_mode', 16);
                $table->longText('logged_text')->nullable();
                $table->unsignedInteger('logged_by')->nullable();
                $table->timestamp('logged_at');
                $table->timestamps();
            });
        }
    }

    private function insertApiToken(string $token, ?int $companyId = 1, bool $unrestricted = true): void
    {
        DB::table('api_tokens')->insert([
            'token' => ApiToken::hashToken($token),
            'name' => 'Test Token',
            'permissions' => json_encode([]),
            'unrestricted' => $unrestricted,
            'revoked' => false,
            'company_id' => $companyId,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
