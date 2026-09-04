<?php

namespace Tests\Feature\Dashboard;

use App\Http\Controllers\DashboardV2Controller;
use App\Models\LeadAgent;
use App\Models\Module;
use App\Services\Dashboard\TeamDownlineService;
use App\Services\HierarchyService;
use App\Services\LevelService;
use App\Services\MlmCommissionService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Mockery;
use ReflectionClass;
use Tests\TestCase;

/**
 * The team dashboard's downline rollup.
 *
 * Two things make this worth testing against real tables rather than reading:
 * the tree walk, which has to reach past one level without ever reaching
 * sideways into someone else's downline; and the commission rollup, which is
 * money. A funnel that reads 3% low is a bug; a commission column that shows a
 * manager an agent who does not report to them is a data leak.
 *
 * Schema is hand-built here, as everywhere else in this directory — see
 * DashboardV2MigrationsTest's note on why running the real migration stack for
 * a read-only panel is not a trade this suite makes.
 *
 * The commission engine itself is mocked. preview() has its own coverage in
 * CommissionPreviewTest, and what matters here is the opposite question: given
 * legs, does the rollup attribute them to the right agent and drop the ones
 * that belong to nobody in this tree.
 */
class TeamDownlineTest extends TestCase
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

        $this->resetSchema();
        $this->createMinimalSchema();
    }

    protected function tearDown(): void
    {
        Mockery::close();
        $this->resetSchema();
        parent::tearDown();
    }

    // ── Registration ────────────────────────────────────────────────────────

    public function test_the_team_dashboard_flag_is_known(): void
    {
        $this->assertContains('crm.team-dashboard', config('features.known_flags'));
    }

    public function test_the_permission_is_registered_on_the_dashboards_module(): void
    {
        $dashboards = collect(Module::MODULE_LIST)
            ->firstWhere('module_name', 'dashboards');

        $this->assertNotNull($dashboards, 'dashboards module is missing');
        $this->assertContains(
            'view_team_dashboard',
            array_column($dashboards['permissions'], 'name'),
            'A new company would never be seeded the permission the route gates on'
        );
    }

    public function test_the_view_is_keyed_to_its_own_permission(): void
    {
        $views = (new ReflectionClass(DashboardV2Controller::class))
            ->getConstant('VIEWS');

        // The naming convention the other four follow, and what the migration
        // and Module::MODULE_LIST entry both have to agree with.
        $this->assertSame('team', $views['view_team_dashboard'] ?? null);
    }

    // ── The tree walk ───────────────────────────────────────────────────────

    public function test_three_generations_resolve_from_parent_agent_id(): void
    {
        [$root] = $this->threeGenerations();

        $depths = $this->service()->downlineDepths($root);

        $this->assertSame(
            [1 => 0, 2 => 1, 3 => 1, 4 => 2, 5 => 3],
            $depths,
            'The walk stopped short of the full subtree'
        );
    }

    public function test_the_closure_table_is_used_when_it_has_been_backfilled(): void
    {
        [$root] = $this->threeGenerations();

        // agent_hierarchy is empty in this product today, which is why the
        // walk falls back to parent_agent_id — but the preferred path has to
        // be right for the day it is backfilled. The rows below deliberately
        // disagree with parent_agent_id (agent 4 at depth 5, agent 5 absent),
        // so a result matching them can only have come from the closure table.
        foreach ([[1, 2, 1], [1, 3, 1], [1, 4, 5]] as [$ancestor, $descendant, $depth]) {
            DB::table('agent_hierarchy')->insert([
                'company_id' => $this->companyId,
                'ancestor_id' => $ancestor,
                'descendant_id' => $descendant,
                'depth' => $depth,
            ]);
        }

        $this->assertSame([1 => 0, 2 => 1, 3 => 1, 4 => 5], $this->service()->downlineDepths($root));
    }

    public function test_a_manager_with_no_sub_agents_is_alone_in_their_tree(): void
    {
        $root = $this->agent(id: 1, userId: 100);

        $this->assertSame([1 => 0], $this->service()->downlineDepths($root));

        $summary = $this->service()->summary($root, 30);

        // Zero, not an error: a manager who has not recruited anyone yet is a
        // normal state, and the page renders an empty table for it.
        $this->assertSame(0, $summary['agents']);
        $this->assertSame(0, $summary['generations']);
    }

    public function test_another_managers_downline_is_not_visible(): void
    {
        [$root] = $this->threeGenerations();

        // A separate tree entirely: their own root, with a report under it.
        $this->agent(id: 20, userId: 120);
        $this->agent(id: 21, userId: 121, parentId: 20);

        $depths = $this->service()->downlineDepths($root);

        $this->assertArrayNotHasKey(20, $depths, 'Another manager leaked into the tree');
        $this->assertArrayNotHasKey(21, $depths, 'Another downline leaked into the tree');
    }

    public function test_a_parent_cycle_terminates_instead_of_walking_forever(): void
    {
        $root = $this->agent(id: 1, userId: 100);
        $this->agent(id: 2, userId: 101, parentId: 1);

        // parent_agent_id is writable with no FK-level cycle check, so bad data
        // can point a parent back at its own descendant.
        DB::table('lead_agents')->where('id', 1)->update(['parent_agent_id' => 2]);

        $this->assertSame([1 => 0, 2 => 1], $this->service()->downlineDepths($root));
    }

    // ── Commission rollups ──────────────────────────────────────────────────

    public function test_level_totals_match_a_manual_sum_across_the_whole_tree(): void
    {
        [$root] = $this->threeGenerations();

        $this->commission(agentId: 1, amount: 500, status: 'paid', paidAt: now()->subDays(2));
        $this->commission(agentId: 2, amount: 300, status: 'paid', paidAt: now()->subDay());
        $this->commission(agentId: 3, amount: 200, status: 'pending');
        $this->commission(agentId: 4, amount: 150, status: 'paid', paidAt: now());
        $this->commission(agentId: 5, amount: 75, status: 'pending');

        $rollup = $this->service()->levelRollup($root, 30);
        $rows = collect($rollup['rows'])->keyBy('depth');

        $this->assertSame([0, 1, 2, 3], $rows->keys()->all());
        $this->assertSame(500.0, $rows[0]['paid']);
        $this->assertSame(300.0, $rows[1]['paid']);
        $this->assertSame(200.0, $rows[1]['pending']);
        $this->assertSame(150.0, $rows[2]['paid']);
        $this->assertSame(75.0, $rows[3]['pending']);

        // The whole point of rolling up by the receiving agent: the levels add
        // up to the tree total, with nothing counted twice and nothing lost.
        $this->assertSame(950.0, array_sum(array_column($rollup['rows'], 'paid')));
        $this->assertSame(275.0, array_sum(array_column($rollup['rows'], 'pending')));
        $this->assertSame(5, array_sum(array_column($rollup['rows'], 'agents')));

        // And the tile row has to agree with the table under it.
        $summary = $this->service()->summary($root, 30);
        $this->assertSame(950.0, $summary['paid']);
        $this->assertSame(275.0, $summary['pending']);
    }

    public function test_each_status_lands_in_its_own_bucket(): void
    {
        [$root] = $this->threeGenerations();

        $this->commission(agentId: 2, amount: 100, status: 'paid', paidAt: now());
        $this->commission(agentId: 2, amount: 40, status: 'pending');
        // Neither owed nor earned — a clawed-back leg must fall out of both.
        $this->commission(agentId: 2, amount: 999, status: 'reverted');

        $row = collect($this->service()->agentRollup($root, 30)['rows'])
            ->firstWhere('agent_id', 2);

        $this->assertSame(100.0, $row['paid']);
        $this->assertSame(40.0, $row['pending']);
    }

    public function test_the_houses_own_cut_is_never_shown_as_an_agents(): void
    {
        [$root] = $this->threeGenerations();

        $this->commission(agentId: 2, amount: 100, status: 'paid', paidAt: now());
        $this->commission(agentId: 2, amount: 900, status: 'paid', paidAt: now(), type: 'system');

        $row = collect($this->service()->agentRollup($root, 30)['rows'])
            ->firstWhere('agent_id', 2);

        $this->assertSame(100.0, $row['paid'], 'A system leg was credited to an agent');
    }

    public function test_paid_respects_the_window_and_pending_deliberately_does_not(): void
    {
        [$root] = $this->threeGenerations();

        $this->commission(agentId: 2, amount: 100, status: 'paid', paidAt: now()->subDays(5));
        $this->commission(agentId: 2, amount: 500, status: 'paid', paidAt: now()->subDays(200));
        // An unpaid balance is standing, not earned on a date — a manager
        // asking what is owed does not mean "owed since last month".
        $this->commission(agentId: 2, amount: 70, status: 'pending');

        $summary = $this->service()->summary($root, 30);

        $this->assertSame(100.0, $summary['paid']);
        $this->assertSame(70.0, $summary['pending']);

        $this->assertSame(600.0, $this->service()->summary($root, 365)['paid']);
    }

    public function test_a_commission_paid_to_an_agent_outside_the_tree_is_not_counted(): void
    {
        [$root] = $this->threeGenerations();

        $this->agent(id: 20, userId: 120);
        $this->commission(agentId: 20, amount: 5000, status: 'paid', paidAt: now());

        $this->assertSame(0.0, $this->service()->summary($root, 30)['paid']);
    }

    // ── Forecast ────────────────────────────────────────────────────────────

    public function test_forecast_credits_the_agent_the_leg_would_pay(): void
    {
        [$root] = $this->threeGenerations();
        $this->deal(id: 1, agentId: 4, open: true);

        // A sub-agent's open deal pays them their own leg and the manager an
        // upline differential. Both are inside the tree, on different rows.
        $service = $this->service(legs: [
            ['agent_id' => 4, 'amount' => 800, 'type' => 'agent'],
            ['agent_id' => 1, 'amount' => 200, 'type' => 'upline'],
        ]);

        $rows = collect($service->agentRollup($root, 30)['rows'])->keyBy('agent_id');

        $this->assertSame(800.0, $rows[4]['forecast']);
        $this->assertSame(200.0, $rows[1]['forecast']);
    }

    public function test_forecast_drops_legs_for_agents_outside_the_tree(): void
    {
        [$root] = $this->threeGenerations();
        $this->agent(id: 20, userId: 120);
        $this->deal(id: 1, agentId: 4, open: true);

        // An upline leg can legitimately point at an ancestor above this
        // manager. It is not theirs to see, and it must not inflate the tree.
        $service = $this->service(legs: [
            ['agent_id' => 4, 'amount' => 800, 'type' => 'agent'],
            ['agent_id' => 20, 'amount' => 300, 'type' => 'upline'],
            ['agent_id' => 4, 'amount' => 100, 'type' => 'system'],
        ]);

        $rollup = $service->levelRollup($root, 30);

        $this->assertSame(
            800.0,
            array_sum(array_column($rollup['rows'], 'forecast')),
            'A leg belonging to someone outside the tree, or to the house, was rolled in'
        );
    }

    public function test_a_closed_deal_is_not_forecast(): void
    {
        [$root] = $this->threeGenerations();
        $this->deal(id: 1, agentId: 4, open: false);

        $service = $this->service(legs: [
            ['agent_id' => 4, 'amount' => 800, 'type' => 'agent'],
        ]);

        $rollup = $service->levelRollup($root, 30);

        $this->assertSame(0, $rollup['forecast_deals']);
        $this->assertSame(0.0, array_sum(array_column($rollup['rows'], 'forecast')));
    }

    // ── Deal counts ─────────────────────────────────────────────────────────

    public function test_won_deals_are_counted_per_agent_inside_the_window(): void
    {
        [$root] = $this->threeGenerations();

        $this->deal(id: 1, agentId: 2, open: false, wonAt: now()->subDay());
        $this->deal(id: 2, agentId: 2, open: false, wonAt: now()->subDays(200));
        $this->deal(id: 3, agentId: 5, open: false, wonAt: now());
        $this->deal(id: 4, agentId: 5, open: true);

        $rows = collect($this->service()->agentRollup($root, 30)['rows'])->keyBy('agent_id');

        $this->assertSame(1, $rows[2]['deals_won']);
        $this->assertSame(1, $rows[5]['deals_won']);
        $this->assertSame(1, $rows[5]['deals_open']);
        $this->assertSame(2, $this->service()->summary($root, 30)['deals_won']);
    }

    public function test_agent_rows_are_ordered_by_level_then_name(): void
    {
        [$root] = $this->threeGenerations();

        $rows = $this->service()->agentRollup($root, 30)['rows'];

        $this->assertSame([0, 1, 1, 2, 3], array_column($rows, 'depth'));
        // The viewer's own row leads, so a manager reads down from themselves.
        $this->assertSame(1, $rows[0]['agent_id']);
        $this->assertSame(2, $rows[0]['direct_reports']);
    }

    // ── Fixtures ────────────────────────────────────────────────────────────

    /**
     * A three-generation tree rooted at agent 1:
     *
     *   1 ─┬─ 2 ── 4 ── 5
     *      └─ 3
     *
     * @return array{0: LeadAgent}
     */
    private function threeGenerations(): array
    {
        $root = $this->agent(id: 1, userId: 100, name: 'Ada Root');
        $this->agent(id: 2, userId: 101, parentId: 1, name: 'Bo Direct');
        $this->agent(id: 3, userId: 102, parentId: 1, name: 'Cy Direct');
        $this->agent(id: 4, userId: 103, parentId: 2, name: 'Di Second');
        $this->agent(id: 5, userId: 104, parentId: 4, name: 'Eli Third');

        return [$root];
    }

    /**
     * @param  array<int, array<string, mixed>>  $legs  What preview() returns for every open deal.
     */
    private function service(array $legs = []): TeamDownlineService
    {
        $commissions = Mockery::mock(MlmCommissionService::class);
        $commissions->shouldReceive('preview')->andReturn($legs);

        $levels = Mockery::mock(LevelService::class);
        $levels->shouldReceive('getCurrentLevel')->andReturn(null);

        return new TeamDownlineService(
            app(HierarchyService::class),
            $levels,
            $commissions,
        );
    }

    private function agent(int $id, int $userId, ?int $parentId = null, string $name = 'Agent'): LeadAgent
    {
        // Inserted directly: LeadAgentObserver fans out to metrics, levels and
        // cycle bookkeeping on save, none of which these tests are about.
        DB::table('users')->insert([
            'id' => $userId,
            'company_id' => $this->companyId,
            'name' => $name,
            'email' => "user{$userId}@example.test",
        ]);

        DB::table('lead_agents')->insert([
            'id' => $id,
            'company_id' => $this->companyId,
            'user_id' => $userId,
            'parent_agent_id' => $parentId,
        ]);

        return LeadAgent::find($id);
    }

    private function commission(
        int $agentId,
        float $amount,
        string $status,
        $paidAt = null,
        string $type = 'agent'
    ): void {
        DB::table('mlm_commissions')->insert([
            'company_id' => $this->companyId,
            'agent_id' => $agentId,
            'amount' => $amount,
            'status' => $status,
            'type' => $type,
            'paid_at' => $paidAt,
        ]);
    }

    private function deal(int $id, int $agentId, bool $open, $wonAt = null): void
    {
        DB::table('deals')->insert([
            'id' => $id,
            'company_id' => $this->companyId,
            'name' => "Deal {$id}",
            'agent_id' => $agentId,
            'value' => 100000,
            'outcome_status' => $open ? null : 'won',
            'won_at' => $wonAt,
            'created_at' => now(),
            'updated_at' => $wonAt ?? now(),
        ]);
    }

    private function resetSchema(): void
    {
        foreach ([
            'mlm_commissions', 'deals', 'agent_hierarchy',
            'lead_agents', 'users', 'companies',
        ] as $table) {
            Schema::dropIfExists($table);
        }
    }

    private function createMinimalSchema(): void
    {
        Schema::create('companies', function (Blueprint $table) {
            $table->increments('id');
            $table->string('company_name')->nullable();
        });

        Schema::create('users', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name')->nullable();
            $table->string('email')->nullable();
            $table->string('image')->nullable();
            $table->string('status')->default('active');
            $table->timestamps();
        });

        Schema::create('lead_agents', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('user_id')->nullable();
            $table->unsignedInteger('parent_agent_id')->nullable();
            $table->timestamps();
        });

        Schema::create('agent_hierarchy', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('ancestor_id');
            $table->unsignedInteger('descendant_id');
            $table->unsignedInteger('depth');
            $table->timestamps();
        });

        Schema::create('deals', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name');
            $table->unsignedInteger('agent_id')->nullable();
            $table->decimal('value', 15, 2)->nullable();
            $table->string('outcome_status')->nullable();
            $table->timestamp('won_at')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });

        Schema::create('mlm_commissions', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('agent_id')->nullable();
            $table->unsignedInteger('deal_id')->nullable();
            $table->decimal('amount', 15, 2)->default(0);
            $table->string('type')->nullable();
            $table->string('status')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->timestamps();
        });

        DB::table('companies')->insert(['id' => $this->companyId, 'company_name' => 'Test']);
    }
}
