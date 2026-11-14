<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\CallLog\CallLogService;
use App\Services\FeatureFlagService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Mockery;
use Tests\TestCase;

/**
 * The call log decides which calls a viewer sees (scope) and which recording
 * links reach them (serialize). A regression here leaks other agents' calls
 * or recording ids, so both are pinned down.
 */
class CallLogServiceTest extends TestCase
{
    private const COMPANY_ID = 1;

    private const OTHER_COMPANY_ID = 2;

    private const VIEWER_ID = 99;

    private const OTHER_AGENT_ID = 100;

    private const LEAD_ID = 10;

    private const OTHER_LEAD_ID = 11;

    private const VISIBLE_DEAL_ID = 20;

    private const HIDDEN_DEAL_ID = 21;

    protected function setUp(): void
    {
        parent::setUp();

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');
        DB::purge('sqlite');
        DB::reconnect('sqlite');

        $this->dropSchema();
        $this->createSchema();
        $this->seedEventTypes();
    }

    protected function tearDown(): void
    {
        Mockery::close();
        $this->dropSchema();

        parent::tearDown();
    }

    // ─── Scope ──────────────────────────────────────────────────────────

    public function test_a_lead_scope_returns_only_that_lead_and_its_visible_deals(): void
    {
        $viewer = $this->actingAsUser();

        $onLead = $this->insertEvent(['model_type' => \App\Models\Lead::class, 'model_id' => self::LEAD_ID]);
        $onVisibleDeal = $this->insertEvent(['model_type' => \App\Models\Deal::class, 'model_id' => self::VISIBLE_DEAL_ID]);
        $onHiddenDeal = $this->insertEvent(['model_type' => \App\Models\Deal::class, 'model_id' => self::HIDDEN_DEAL_ID]);
        $onOtherLead = $this->insertEvent(['model_type' => \App\Models\Lead::class, 'model_id' => self::OTHER_LEAD_ID]);
        $unlinked = $this->insertEvent(['model_type' => null, 'model_id' => null]);
        $otherTenant = $this->insertEvent([
            'model_type' => \App\Models\Lead::class,
            'model_id' => self::LEAD_ID,
            'company_id' => self::OTHER_COMPANY_ID,
        ]);

        $ids = $this->ids(app(CallLogService::class)->paginate(
            $viewer,
            self::COMPANY_ID,
            [],
            ['lead_ids' => [self::LEAD_ID], 'deal_ids' => [self::VISIBLE_DEAL_ID]],
            50,
        ));

        $this->assertEqualsCanonicalizing([$onLead, $onVisibleDeal], $ids);
        $this->assertNotContains($onHiddenDeal, $ids, 'A deal the viewer cannot see must not leak its calls.');
        $this->assertNotContains($onOtherLead, $ids);
        $this->assertNotContains($unlinked, $ids);
        $this->assertNotContains($otherTenant, $ids, 'Never another company.');
    }

    public function test_an_empty_scope_matches_nothing(): void
    {
        $viewer = $this->actingAsUser();
        $this->insertEvent(['model_type' => \App\Models\Lead::class, 'model_id' => self::LEAD_ID]);

        $ids = $this->ids(app(CallLogService::class)->paginate(
            $viewer,
            self::COMPANY_ID,
            [],
            ['lead_ids' => [], 'deal_ids' => []],
            50,
        ));

        $this->assertSame([], $ids);
    }

    // ─── Recording links ────────────────────────────────────────────────

    public function test_recording_links_are_withheld_from_a_viewer_who_may_not_play(): void
    {
        $viewer = $this->actingAsUser(['make_softphone_calls' => 'added']);
        $recordingId = $this->insertRecording(self::OTHER_AGENT_ID);
        $this->insertEvent(['user_id' => self::OTHER_AGENT_ID, 'metadata' => ['recording_id' => $recordingId]]);

        $row = $this->rows(app(CallLogService::class)->paginate($viewer, self::COMPANY_ID, [], null, 50))[0];

        $this->assertTrue($row['has_recording']);
        $this->assertFalse($row['recording']['can_play']);
        $this->assertNull($row['recording']['id'], 'The recording id must not reach a viewer who cannot play it.');
        $this->assertNull($row['recording']['play_url']);
        $this->assertNull($row['recording']['download_url']);
    }

    public function test_the_agent_on_the_call_gets_the_recording_links(): void
    {
        $viewer = $this->actingAsUser(['make_softphone_calls' => 'added']);
        $recordingId = $this->insertRecording(self::VIEWER_ID);
        $this->insertEvent(['user_id' => self::VIEWER_ID, 'metadata' => ['recording_id' => $recordingId]]);

        $row = $this->rows(app(CallLogService::class)->paginate($viewer, self::COMPANY_ID, [], null, 50))[0];

        $this->assertTrue($row['recording']['can_play']);
        $this->assertSame($recordingId, $row['recording']['id']);
        $this->assertNotNull($row['recording']['play_url']);
    }

    public function test_a_call_manager_gets_every_recording_link(): void
    {
        $viewer = $this->actingAsUser(['manage_calls' => 'all']);
        $recordingId = $this->insertRecording(self::OTHER_AGENT_ID);
        $this->insertEvent(['user_id' => self::OTHER_AGENT_ID, 'metadata' => ['recording_id' => $recordingId]]);

        $row = $this->rows(app(CallLogService::class)->paginate($viewer, self::COMPANY_ID, [], null, 50))[0];

        $this->assertTrue($row['recording']['can_play']);
    }

    public function test_an_expired_recording_is_never_playable(): void
    {
        $viewer = $this->actingAsUser(['manage_calls' => 'all']);
        $recordingId = $this->insertRecording(self::VIEWER_ID, now()->subDay());
        $this->insertEvent(['user_id' => self::VIEWER_ID, 'metadata' => ['recording_id' => $recordingId]]);

        $row = $this->rows(app(CallLogService::class)->paginate($viewer, self::COMPANY_ID, [], null, 50))[0];

        $this->assertTrue($row['recording']['expired']);
        $this->assertFalse($row['recording']['can_play']);
        $this->assertNull($row['recording']['play_url']);
    }

    // ─── Summary ────────────────────────────────────────────────────────

    public function test_the_summary_counts_over_the_scope(): void
    {
        $this->actingAsUser();
        $recordingId = $this->insertRecording(self::VIEWER_ID);
        $this->insertEvent(['model_type' => \App\Models\Lead::class, 'model_id' => self::LEAD_ID, 'metadata' => ['duration' => 60, 'recording_id' => $recordingId]]);
        $this->insertEvent(['model_type' => \App\Models\Lead::class, 'model_id' => self::LEAD_ID, 'metadata' => ['duration' => 30]]);
        $this->insertEvent(['model_type' => \App\Models\Lead::class, 'model_id' => self::LEAD_ID, 'slug' => 'call_missed']);
        $this->insertEvent(['model_type' => \App\Models\Lead::class, 'model_id' => self::OTHER_LEAD_ID, 'metadata' => ['duration' => 999]]);

        $summary = app(CallLogService::class)->summary(self::COMPANY_ID, ['lead_ids' => [self::LEAD_ID]]);

        $this->assertSame(3, $summary['total']);
        $this->assertSame(2, $summary['connected']);
        $this->assertSame(90, $summary['connected_seconds']);
        $this->assertSame(1, $summary['missed']);
        $this->assertSame(1, $summary['with_recording']);
        $this->assertNotNull($summary['last_at']);
    }

    // ─── Endpoint gate ──────────────────────────────────────────────────

    public function test_the_company_call_log_needs_manage_calls(): void
    {
        $this->withoutMiddleware();
        $this->enableCalls();
        $this->actingAsUser(['make_softphone_calls' => 'all']);

        $this->getJson(route('telephony.calls.log'))->assertForbidden();
    }

    public function test_a_call_manager_reads_the_company_call_log(): void
    {
        $this->withoutMiddleware();
        $this->enableCalls();
        $this->actingAsUser(['manage_calls' => 'all']);
        $this->insertEvent([]);

        $this->getJson(route('telephony.calls.log'))
            ->assertOk()
            ->assertJsonPath('meta.total', 1);
    }

    // ─── Helpers ────────────────────────────────────────────────────────

    /**
     * @param  array<string, string>  $permissions
     */
    private function actingAsUser(array $permissions = []): User
    {
        /** @var User&\Mockery\MockInterface $user */
        $user = Mockery::mock(User::class)->makePartial();
        $user->id = self::VIEWER_ID;
        $user->company_id = self::COMPANY_ID;
        $user->shouldReceive('permission')->andReturnUsing(fn (string $name) => $permissions[$name] ?? 'none');
        $user->shouldReceive('hasRole')->andReturn(false);

        $this->actingAs($user);
        session(['user' => $user, 'company' => (object) ['id' => self::COMPANY_ID]]);

        return $user;
    }

    private function enableCalls(): void
    {
        $flags = Mockery::mock(FeatureFlagService::class);
        $flags->shouldReceive('isEnabled')->andReturn(true);
        $flags->shouldReceive('all')->andReturn([]);
        $this->instance(FeatureFlagService::class, $flags);
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    private function insertEvent(array $attributes): int
    {
        $slug = $attributes['slug'] ?? 'call_ended';
        unset($attributes['slug']);
        $metadata = $attributes['metadata'] ?? [];
        unset($attributes['metadata']);

        return (int) DB::table('crm_events')->insertGetId(array_merge([
            'uuid' => (string) Str::uuid(),
            'company_id' => self::COMPANY_ID,
            'event_type_id' => (int) DB::table('crm_event_types')->where('slug', $slug)->value('id'),
            'generation_type' => 'system_generated',
            'status' => 'completed',
            'direction' => 'outbound',
            'user_id' => self::VIEWER_ID,
            'model_type' => null,
            'model_id' => null,
            'correlation_id' => null,
            'source' => 'api',
            'metadata' => json_encode($metadata),
            'occurred_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ], $attributes));
    }

    private function insertRecording(int $userId, $expiresAt = null): int
    {
        return (int) DB::table('call_recordings')->insertGetId([
            'company_id' => self::COMPANY_ID,
            'user_id' => $userId,
            'filename' => 'call.mp3',
            'duration_seconds' => 30,
            'expires_at' => $expiresAt ?? now()->addDays(20),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    /** @return list<int> */
    private function ids($paginator): array
    {
        return array_map(fn ($row) => (int) $row['id'], $this->rows($paginator));
    }

    /** @return list<array<string, mixed>> */
    private function rows($paginator): array
    {
        return array_values($paginator->getCollection()->all());
    }

    private function seedEventTypes(): void
    {
        $categoryId = (int) DB::table('crm_event_categories')->insertGetId([
            'company_id' => null,
            'name' => 'Calls',
            'slug' => 'calls',
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        foreach (CallLogService::OUTCOMES as $outcome) {
            DB::table('crm_event_types')->insert([
                'company_id' => null,
                'category_id' => $categoryId,
                'name' => 'call_' . $outcome,
                'slug' => 'call_' . $outcome,
                'is_system' => true,
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    private function createSchema(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->increments('id');
            $table->string('name')->nullable();
            $table->unsignedInteger('company_id')->nullable();
            $table->string('status')->default('active');
            $table->timestamps();
        });

        Schema::create('leads', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('client_name')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });

        Schema::create('deals', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('lead_id')->nullable();
            $table->string('name')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });

        Schema::create('call_recordings', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('filename');
            $table->unsignedInteger('duration_seconds')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->string('call_ref')->nullable();
            $table->timestamps();
        });

        Schema::create('crm_event_categories', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name');
            $table->string('slug');
            $table->string('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('crm_event_types', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('category_id');
            $table->string('name');
            $table->string('slug');
            $table->string('description')->nullable();
            $table->string('model_type')->nullable();
            $table->unsignedInteger('business_rule_id')->nullable();
            $table->boolean('is_system')->default(false);
            $table->boolean('is_active')->default(true);
            $table->boolean('sync_processing')->default(false);
            $table->text('metadata_schema')->nullable();
            $table->timestamps();
        });

        Schema::create('crm_events', function (Blueprint $table) {
            $table->increments('id');
            $table->uuid('uuid');
            $table->unsignedInteger('company_id');
            $table->unsignedInteger('event_type_id');
            $table->string('generation_type');
            $table->string('status')->default('completed');
            $table->string('direction')->nullable();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('model_type')->nullable();
            $table->unsignedBigInteger('model_id')->nullable();
            $table->uuid('correlation_id')->nullable();
            $table->unsignedInteger('causation_id')->nullable();
            $table->string('source')->nullable();
            $table->string('ip_address')->nullable();
            $table->string('user_agent')->nullable();
            $table->text('metadata')->nullable();
            $table->timestamp('occurred_at')->nullable();
            $table->timestamps();
        });
    }

    private function dropSchema(): void
    {
        foreach (['crm_events', 'crm_event_types', 'crm_event_categories', 'call_recordings', 'deals', 'leads', 'users'] as $table) {
            Schema::dropIfExists($table);
        }
    }
}
