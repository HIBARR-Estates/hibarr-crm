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
