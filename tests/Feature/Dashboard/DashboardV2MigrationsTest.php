<?php

namespace Tests\Feature\Dashboard;

use App\Models\PermissionType;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * The dashboard v2 migrations, exercised rather than assumed.
 *
 * Every other test in this directory builds the schema it needs by hand, which
 * means nothing had ever actually run these files. They write to `leads` and
 * `deals` across the whole database, so "it looked right in review" is not the
 * standard they should ship at.
 *
 * What this cannot cover: the raw statements in the backfill are MySQL-only
 * (multi-table UPDATE ... JOIN, JSON_EXTRACT) and SQLite has no equivalent, so
 * the assertion there is that the driver guard holds and the migration is a
 * clean no-op. The seeding arithmetic itself still needs a MySQL staging run.
 */
class DashboardV2MigrationsTest extends TestCase
{
    private int $companyId = 1;

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

    // ── 2026_08_07_000001 — tracking columns ────────────────────────────────

    public function test_tracking_columns_migration_adds_every_column_the_panels_read(): void
    {
        $this->trackingColumns()->up();

        foreach ([
            'primary_language',
            'assigned_at',
            'first_contacted_at',
            'referred_by_agent_id',
        ] as $column) {
            $this->assertTrue(Schema::hasColumn('leads', $column), "leads.{$column} missing");
        }

        $this->assertTrue(Schema::hasColumn('deals', 'stage_entered_at'));
        $this->assertTrue(Schema::hasColumn('deals', 'exchange_rate'));
        $this->assertTrue(Schema::hasColumn('pipeline_stages', 'target_duration_days'));
        $this->assertTrue(Schema::hasColumn('lead_setting', 'first_contact_sla_hours'));
    }

    public function test_first_contact_sla_defaults_to_24_hours(): void
    {
        $this->trackingColumns()->up();

        DB::table('lead_setting')->insert([
            'company_id' => $this->companyId,
            'user_id' => 1,
        ]);

        // The dashboard falls back to 24 in code as well, but a row written by
        // any other screen has to arrive with a usable value, not NULL.
        $this->assertSame(24, (int) DB::table('lead_setting')->value('first_contact_sla_hours'));
    }

    public function test_tracking_columns_migration_can_be_run_twice(): void
    {
        $migration = $this->trackingColumns();

        $migration->up();
        $migration->up();

        // A half-applied deploy re-running the batch must not abort on "column
        // already exists" — every block is guarded by hasColumn.
        $this->assertTrue(Schema::hasColumn('leads', 'first_contacted_at'));
    }

    public function test_tracking_columns_migration_rolls_back_cleanly(): void
    {
        $migration = $this->trackingColumns();

        $migration->up();
        $migration->down();

        $this->assertFalse(Schema::hasColumn('leads', 'primary_language'));
        $this->assertFalse(Schema::hasColumn('leads', 'assigned_at'));
        $this->assertFalse(Schema::hasColumn('leads', 'first_contacted_at'));
        $this->assertFalse(Schema::hasColumn('leads', 'referred_by_agent_id'));
        $this->assertFalse(Schema::hasColumn('deals', 'stage_entered_at'));
        $this->assertFalse(Schema::hasColumn('deals', 'exchange_rate'));
        $this->assertFalse(Schema::hasColumn('pipeline_stages', 'target_duration_days'));
        $this->assertFalse(Schema::hasColumn('lead_setting', 'first_contact_sla_hours'));
    }

    // ── 2026_08_07_000002 — backfill ────────────────────────────────────────

    public function test_backfill_migration_is_a_no_op_on_non_mysql_drivers(): void
    {
        $this->trackingColumns()->up();

        $leadId = DB::table('leads')->insertGetId([
            'company_id' => $this->companyId,
            'client_name' => 'Untouched',
            'lead_owner' => 1,
            'created_at' => now()->subYear(),
            'updated_at' => now()->subYear(),
        ]);

        // Every statement in this migration is MySQL-only. Without the driver
        // guard this call is a fatal SQL error, which is exactly what would
        // have happened the first time anyone pointed the suite at it.
        $this->backfill()->up();

        $this->assertNull(DB::table('leads')->where('id', $leadId)->value('first_contacted_at'));
    }

    // ── 2026_08_09_000002 — next step flag ──────────────────────────────────

    public function test_next_step_flag_is_added_and_defaults_to_false(): void
    {
        $migration = $this->nextStepFlag();

        $migration->up();

        $this->assertTrue(Schema::hasColumn('tasks', 'is_next_step'));

        $taskId = DB::table('tasks')->insertGetId([
            'company_id' => $this->companyId,
            'heading' => 'Ordinary task',
            'board_column_id' => 1,
            'priority' => 'medium',
        ]);

        // Defaulting to true would put every historical task in the agent's
        // "next step" list on day one.
        $this->assertSame(0, (int) DB::table('tasks')->where('id', $taskId)->value('is_next_step'));

        $migration->up();
        $this->assertTrue(Schema::hasColumn('tasks', 'is_next_step'));

        $migration->down();
        $this->assertFalse(Schema::hasColumn('tasks', 'is_next_step'));
    }

    // ── 2026_08_09_000003 — partner_flags ───────────────────────────────────

    public function test_partner_flags_table_is_created_and_dropped(): void
    {
        $migration = $this->partnerFlags();

        $migration->up();

        $this->assertTrue(Schema::hasTable('partner_flags'));

        $this->seedAgent(agentId: 300, userId: 30);
        $leadId = DB::table('leads')->insertGetId([
            'company_id' => $this->companyId,
            'client_name' => 'Flagged lead',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('partner_flags')->insert([
            'company_id' => $this->companyId,
            'lead_agent_id' => 300,
            'lead_id' => $leadId,
            'reason' => 'stalled',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // New flags start open, which is what puts them in the manager queue.
        $this->assertSame('open', DB::table('partner_flags')->value('status'));

        // Re-running must not fail on "table already exists".
        $migration->up();

        $migration->down();
        $this->assertFalse(Schema::hasTable('partner_flags'));
    }

    public function test_partner_flag_cannot_reference_a_lead_that_does_not_exist(): void
    {
        $this->partnerFlags()->up();
        $this->seedAgent(agentId: 301, userId: 31);

        // A flag with no referral behind it is a support ticket, and this is
        // deliberately not a support inbox — the foreign key is what enforces it.
        $this->expectException(\Illuminate\Database\QueryException::class);

        DB::table('partner_flags')->insert([
            'company_id' => $this->companyId,
            'lead_agent_id' => 301,
            'lead_id' => 999999,
            'reason' => 'stalled',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    // ── 2026_08_09_000001 — revoke partner dashboard ────────────────────────

    public function test_revoke_keeps_the_partner_grant_only_for_accounts_with_referrals(): void
    {
        $this->trackingColumns()->up();

        $permissionId = $this->seedPartnerPermission();

        // A role grant, which the migration removes outright: "everyone with
        // this job title" can never be the right answer for a per-agent view.
        DB::table('permission_role')->insert([
            'permission_id' => $permissionId,
            'role_id' => 1,
            'permission_type_id' => PermissionType::ALL,
        ]);

        $partnerUser = 10;
        $staffUser = 11;

        $this->seedAgent(agentId: 100, userId: $partnerUser);
        $this->seedAgent(agentId: 101, userId: $staffUser);

        // Only the first agent ever introduced anyone.
        DB::table('leads')->insert([
            'company_id' => $this->companyId,
            'client_name' => 'Referred lead',
            'referred_by_agent_id' => 100,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->grantPartnerDashboard($permissionId, [$partnerUser, $staffUser]);

        $this->revokePartnerDashboard()->up();

        $this->assertSame(
            0,
            DB::table('permission_role')->where('permission_id', $permissionId)->count(),
            'the role-wide grant should be gone'
        );

        $this->assertSame(
            PermissionType::ALL,
            $this->permissionTypeFor($permissionId, $partnerUser),
            'an account with referrals keeps the view'
        );

        // Downgraded, not deleted — the settings screen renders its toggle from
        // this row, so removing it would take the control away entirely.
        $this->assertSame(
            PermissionType::NONE,
            $this->permissionTypeFor($permissionId, $staffUser),
            'a staff account with no referrals loses the view but keeps the toggle'
        );
    }

    public function test_revoke_keeps_the_grant_for_an_agent_with_commission_but_no_referred_lead(): void
    {
        $this->trackingColumns()->up();

        $permissionId = $this->seedPartnerPermission();
        $earnerUser = 20;

        $this->seedAgent(agentId: 200, userId: $earnerUser);

        // Paid on someone else's referral: still a partner, still needs the view.
        DB::table('mlm_commissions')->insert([
            'company_id' => $this->companyId,
            'agent_id' => 200,
            'amount' => 1500,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->grantPartnerDashboard($permissionId, [$earnerUser]);

        $this->revokePartnerDashboard()->up();

        $this->assertSame(PermissionType::ALL, $this->permissionTypeFor($permissionId, $earnerUser));
    }

    public function test_revoke_is_a_no_op_when_the_permission_was_never_created(): void
    {
        $this->trackingColumns()->up();

        // Nothing seeded: a deployment that never ran the grant migration must
        // not fatal here.
        $this->revokePartnerDashboard()->up();

        $this->assertSame(0, DB::table('user_permissions')->count());
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    private function migration(string $filename): Migration
    {
        // require, not require_once: each test needs its own instance, and the
        // file returns a fresh anonymous class every time it is evaluated.
        return require database_path('migrations/'.$filename);
    }

    private function trackingColumns(): Migration
    {
        return $this->migration('2026_08_07_000001_add_dashboard_v2_tracking_columns.php');
    }

    private function backfill(): Migration
    {
        return $this->migration('2026_08_07_000002_backfill_dashboard_v2_tracking_columns.php');
    }

    private function revokePartnerDashboard(): Migration
    {
        return $this->migration('2026_08_09_000001_revoke_partner_dashboard_from_staff.php');
    }

    private function nextStepFlag(): Migration
    {
        return $this->migration('2026_08_09_000002_add_next_step_flag_to_tasks.php');
    }

    private function partnerFlags(): Migration
    {
        return $this->migration('2026_08_09_000003_create_partner_flags_table.php');
    }

    private function seedPartnerPermission(): int
    {
        return DB::table('permissions')->insertGetId([
            'name' => 'view_partner_dashboard',
            'display_name' => 'View Partner Dashboard',
            'is_custom' => 1,
        ]);
    }

    private function seedAgent(int $agentId, int $userId): void
    {
        DB::table('users')->insert([
            'id' => $userId,
            'company_id' => $this->companyId,
            'name' => 'User '.$userId,
            'email' => "user{$userId}@test.local",
            'status' => 'active',
        ]);

        DB::table('lead_agents')->insert([
            'id' => $agentId,
            'company_id' => $this->companyId,
            'user_id' => $userId,
        ]);
    }

    /** @param array<int, int> $userIds */
    private function grantPartnerDashboard(int $permissionId, array $userIds): void
    {
        foreach ($userIds as $userId) {
            DB::table('user_permissions')->insert([
                'user_id' => $userId,
                'permission_id' => $permissionId,
                'permission_type_id' => PermissionType::ALL,
            ]);
        }
    }

    private function permissionTypeFor(int $permissionId, int $userId): ?int
    {
        $type = DB::table('user_permissions')
            ->where('permission_id', $permissionId)
            ->where('user_id', $userId)
            ->value('permission_type_id');

        return is_null($type) ? null : (int) $type;
    }

    private function dropSchema(): void
    {
        foreach ([
            'partner_flags',
            'mlm_commissions',
            'user_permissions',
            'permission_role',
            'permissions',
            'roles',
            'lead_agents',
            'pipeline_stages',
            'lead_setting',
            'tasks',
            'deals',
            'leads',
            'users',
            'companies',
        ] as $table) {
            Schema::dropIfExists($table);
        }
    }

    private function createSchema(): void
    {
        Schema::create('companies', function (Blueprint $table) {
            $table->increments('id');
            $table->string('company_name')->nullable();
            $table->timestamps();
        });

        Schema::create('users', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name');
            $table->string('email')->nullable();
            $table->string('status')->default('active');
            $table->timestamps();
        });

        // Columns the migration anchors its after() clauses to are present so the
        // file runs against a realistic shape, even though SQLite ignores after().
        Schema::create('leads', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('source_id')->nullable();
            $table->string('client_name')->nullable();
            $table->unsignedInteger('lead_owner')->nullable();
            $table->text('languages')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });

        Schema::create('deals', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('lead_id')->nullable();
            $table->unsignedInteger('pipeline_stage_id')->nullable();
            $table->unsignedInteger('currency_id')->nullable();
            $table->timestamps();
        });

        Schema::create('pipeline_stages', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name')->nullable();
            $table->unsignedInteger('priority')->default(0);
            $table->timestamps();
        });

        Schema::create('lead_setting', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('user_id')->nullable();
            $table->string('status')->nullable();
        });

        Schema::create('tasks', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('heading');
            $table->unsignedInteger('board_column_id')->nullable();
            $table->string('priority')->default('medium');
        });

        Schema::create('lead_agents', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('user_id')->nullable();
            $table->timestamps();
        });

        Schema::create('roles', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name');
            $table->string('display_name')->nullable();
            $table->timestamps();
        });

        Schema::create('permissions', function (Blueprint $table) {
            $table->increments('id');
            $table->string('name');
            $table->string('display_name')->nullable();
            $table->unsignedInteger('module_id')->nullable();
            $table->tinyInteger('is_custom')->default(0);
            $table->text('allowed_permissions')->nullable();
            $table->timestamps();
        });

        // Shapes copied from 2018_01_01_000000_create_worksuite_new_table: this
        // one is a composite-keyed pivot with no id and no timestamps, while
        // user_permissions has both. The difference is load-bearing — the
        // migration writes to each with a different builder call.
        Schema::create('permission_role', function (Blueprint $table) {
            $table->unsignedInteger('permission_id');
            $table->unsignedInteger('role_id');
            $table->unsignedBigInteger('permission_type_id')->default(PermissionType::NONE);
            $table->primary(['permission_id', 'role_id']);
        });

        Schema::create('user_permissions', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedInteger('user_id');
            $table->unsignedInteger('permission_id');
            $table->unsignedBigInteger('permission_type_id');
            $table->timestamps();
        });

        Schema::create('mlm_commissions', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedBigInteger('agent_id')->nullable();
            $table->decimal('amount', 15, 2)->default(0);
            $table->timestamps();
        });

        DB::table('companies')->insert([
            'id' => $this->companyId,
            'company_name' => 'Test Co',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
