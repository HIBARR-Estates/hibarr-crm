<?php

namespace Tests\Feature\Dashboard;

use App\Services\CrmEventService;
use App\Services\Dashboard\DashboardMetricsService;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * The personal dashboard's recentActivity() panel, behind crm.personal-dashboard.
 *
 * What matters most here is scoping: this is the one new panel that reads
 * across the whole CRM Event Engine rather than through an already-scoped
 * model relation, so it is the one place a careless filter could leak another
 * user's — or another company's — activity onto someone's daily landing page.
 * That is also explicitly called out as the acceptance criteria's Security &
 * Auth requirement, so it gets exercised against real tables rather than
 * asserted from reading the code.
 *
 * personalQueue(), personalStats() and followUpsDue() are not covered here:
 * all three are thin date-window wrappers around Task::scopeVisibleToUser()/
 * scopePending() and DealFollowUp's existing followUpQuery(), which
 * todaySchedule() already ships in production — reproducing Task's full
 * company/active-scope stack in a hand-built schema is a much larger
 * undertaking than this change's risk warrants (see DashboardV2MigrationsTest's
 * own note on why this directory hand-rolls schema instead of running real
 * migrations).
 */
class PersonalDashboardTest extends TestCase
{
    private int $companyId = 1;

    private int $otherCompanyId = 2;

    protected function setUp(): void
    {
        parent::setUp();

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');
        Config::set('cache.default', 'array');

        DB::purge('sqlite');
        DB::reconnect('sqlite');

        $this->dropSchema();
        $this->createSchema();
    }

    protected function tearDown(): void
    {
        $this->dropSchema();
        parent::tearDown();
    }

    public function test_personal_dashboard_flag_is_known(): void
    {
        $this->assertContains('crm.personal-dashboard', config('features.known_flags'));
    }

    public function test_recent_activity_only_returns_the_requesting_users_events(): void
    {
        $categoryId = $this->seedCategory();
        $typeId = $this->seedEventType($categoryId);

        $me = 10;
        $someoneElse = 11;
        $this->seedUser($me, $this->companyId);
        $this->seedUser($someoneElse, $this->companyId);

        $this->seedEvent($typeId, $this->companyId, $me, 'Mine');
        $this->seedEvent($typeId, $this->companyId, $someoneElse, 'Not mine');

        $rows = $this->recentActivity($me, $this->companyId);

        $this->assertCount(1, $rows);
        $this->assertSame($me, $rows[0]['user_id']);
    }

    public function test_recent_activity_does_not_cross_companies(): void
    {
        $categoryId = $this->seedCategory();
        $typeId = $this->seedEventType($categoryId);

        // Same user id, but the row that matters belongs to a different
        // company — company scoping, not just user scoping, must hold.
        $userId = 20;
        $this->seedUser($userId, $this->companyId);

        $this->seedEvent($typeId, $this->otherCompanyId, $userId, 'Wrong company');

        $rows = $this->recentActivity($userId, $this->companyId);

        $this->assertSame([], $rows);
    }

    public function test_recent_activity_orders_newest_first_and_respects_the_limit(): void
    {
        $categoryId = $this->seedCategory();
        $typeId = $this->seedEventType($categoryId);

        $userId = 30;
        $this->seedUser($userId, $this->companyId);

        $this->seedEvent($typeId, $this->companyId, $userId, 'Oldest', now()->subDays(3));
        $this->seedEvent($typeId, $this->companyId, $userId, 'Middle', now()->subDay());
        $this->seedEvent($typeId, $this->companyId, $userId, 'Newest', now());

        $rows = $this->recentActivity($userId, $this->companyId, limit: 2);

        $this->assertCount(2, $rows);
        $this->assertSame('Newest', $rows[0]['metadata']['label']);
        $this->assertSame('Middle', $rows[1]['metadata']['label']);
    }

    public function test_recent_activity_row_shape_matches_the_timeline_transform(): void
    {
        $categoryId = $this->seedCategory();
        $typeId = $this->seedEventType($categoryId);

        $userId = 40;
        $this->seedUser($userId, $this->companyId, name: 'Jordan Rep');

        $this->seedEvent($typeId, $this->companyId, $userId, 'Shaped');

        $row = $this->recentActivity($userId, $this->companyId)[0];

        // CrmEventController's API keys, plus `record` — the name of the thing
        // the event happened on, which ActivityFeed needs because "note added"
        // without saying on what is not activity anyone can read.
        $this->assertSame(
            [
                'uuid', 'event_type', 'generation_type', 'status', 'direction',
                'user_id', 'user', 'model_type', 'model_id', 'correlation_id',
                'causation_id', 'source', 'ip_address', 'metadata', 'occurred_at',
                'created_at', 'record',
            ],
            array_keys($row)
        );
        $this->assertSame('note_added', $row['event_type']['slug']);
        $this->assertSame('Notes', $row['event_type']['category']['name']);
        $this->assertSame('Jordan Rep', $row['user']['name']);
    }

    public function test_recent_activity_leaves_record_null_when_nothing_is_attached(): void
    {
        $categoryId = $this->seedCategory();
        $typeId = $this->seedEventType($categoryId);

        $userId = 50;
        $this->seedUser($userId, $this->companyId);

        // No model_type/model_id: a company-wide event belongs to no record,
        // and the feed must render the row rather than skip or crash on it.
        $this->seedEvent($typeId, $this->companyId, $userId, 'Unattached');

        $this->assertNull($this->recentActivity($userId, $this->companyId)[0]['record']);
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    /** @return array<int, array<string, mixed>> */
    private function recentActivity(int $userId, int $companyId, int $limit = 10): array
    {
        return app(DashboardMetricsService::class)->recentActivity(
            $userId,
            $companyId,
            app(CrmEventService::class),
            $limit
        );
    }

    private function seedCategory(): int
    {
        return DB::table('crm_event_categories')->insertGetId([
            'company_id' => null,
            'name' => 'Notes',
            'slug' => 'notes',
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function seedEventType(int $categoryId): int
    {
        return DB::table('crm_event_types')->insertGetId([
            'company_id' => null,
            'category_id' => $categoryId,
            'name' => 'Note added',
            'slug' => 'note_added',
            'is_system' => true,
            'is_active' => true,
            'sync_processing' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function seedUser(int $userId, int $companyId, string $name = 'Test User'): void
    {
        DB::table('users')->insert([
            'id' => $userId,
            'company_id' => $companyId,
            'name' => $name,
            'email' => "user{$userId}@test.local",
            'status' => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function seedEvent(
        int $typeId,
        int $companyId,
        int $userId,
        string $label,
        $occurredAt = null
    ): void {
        DB::table('crm_events')->insert([
            'uuid' => (string) Str::uuid(),
            'company_id' => $companyId,
            'event_type_id' => $typeId,
            'generation_type' => 'user_generated',
            'status' => 'completed',
            'user_id' => $userId,
            'source' => 'system',
            'metadata' => json_encode(['label' => $label]),
            'occurred_at' => $occurredAt ?? now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function migration(string $filename): Migration
    {
        return require database_path('migrations/'.$filename);
    }

    private function dropSchema(): void
    {
        foreach ([
            'crm_events_archive',
            'crm_event_retention_policies',
            'crm_events',
            'crm_event_types',
            'crm_business_rules',
            'crm_event_categories',
            'users',
            'companies',
        ] as $table) {
            Schema::dropIfExists($table);
        }
    }

    private function createSchema(): void
    {
        Schema::create('companies', function ($table) {
            $table->increments('id');
            $table->string('company_name')->nullable();
            $table->timestamps();
        });

        Schema::create('users', function ($table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name');
            $table->string('email')->nullable();
            $table->string('status')->default('active');
            $table->timestamps();
        });

        $this->migration('2026_03_06_000000_create_crm_event_tables.php')->up();
        $this->migration('2026_03_18_000000_add_status_direction_to_crm_events_table.php')->up();

        DB::table('companies')->insert([
            ['id' => $this->companyId, 'company_name' => 'Test Co', 'created_at' => now(), 'updated_at' => now()],
            ['id' => $this->otherCompanyId, 'company_name' => 'Other Co', 'created_at' => now(), 'updated_at' => now()],
        ]);
    }
}
