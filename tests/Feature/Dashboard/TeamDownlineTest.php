<?php

namespace Tests\Feature\Dashboard;

use App\Http\Controllers\DashboardV2Controller;
use App\Models\LeadAgent;
use App\Models\Module;
use App\Services\Dashboard\TeamDownlineService;
use App\Services\HierarchyService;
use App\Services\LevelService;
use App\Services\MlmCommissionService;
use App\Support\DashboardDateRange;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Mockery;
use ReflectionClass;
use Tests\TestCase;

/**
 * The team dashboard: everything below you, and nothing of your own.
 *
 * Three things make this worth testing against real tables rather than reading:
 * the tree walk, which has to reach past one level without ever reaching
 * sideways into someone else's network; the exclusion of the viewer, which is
 * the whole premise of the page and is invisible if you get it wrong on a
 * manager who sells nothing; and the commission rollup, which is money.
 *
 * Schema is hand-built here, as everywhere else in this directory — see
 * DashboardV2MigrationsTest's note on why running the real migration stack for
 * a read-only panel is not a trade this suite makes.
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

        $this->assertSame('team', $views['view_team_dashboard'] ?? null);
    }

    // ── The tree walk ───────────────────────────────────────────────────────

    public function test_three_generations_resolve_from_parent_agent_id(): void
    {
        [$root] = $this->threeGenerations();

        // The root is absent: it is not part of its own team.
        $this->assertSame(
            [2 => 1, 3 => 1, 4 => 2, 5 => 3],
            $this->service()->teamDepths($root),
            'The walk stopped short of the full subtree'
        );
    }

    public function test_the_closure_table_is_used_when_it_has_been_backfilled(): void
    {
        [$root] = $this->threeGenerations();

        // agent_hierarchy is empty in this product today, which is why the walk
        // falls back to parent_agent_id — but the preferred path has to be right
        // for the day it is backfilled. These rows deliberately disagree with
        // parent_agent_id (agent 4 at depth 5, agent 5 absent), so a result
        // matching them can only have come from the closure table.
        foreach ([[1, 2, 1], [1, 3, 1], [1, 4, 5]] as [$ancestor, $descendant, $depth]) {
            DB::table('agent_hierarchy')->insert([
                'company_id' => $this->companyId,
                'ancestor_id' => $ancestor,
                'descendant_id' => $descendant,
                'depth' => $depth,
            ]);
        }

        $this->assertSame([2 => 1, 3 => 1, 4 => 5], $this->service()->teamDepths($root));
    }

    public function test_a_lead_with_no_sub_agents_has_an_empty_team(): void
    {
        $root = $this->agent(id: 1, userId: 100);

        $this->assertSame([], $this->service()->teamDepths($root));

        $summary = $this->service()->summary($root, $this->range());

        // Zero, not an error: someone who has not recruited anyone yet is a
        // normal state, and the page renders an empty tree for it.
        $this->assertSame(0, $summary['agents']);
        $this->assertSame(0, $summary['generations']);
        $this->assertSame([], $this->service()->tree($root, $this->range())['nodes']);
    }

    public function test_another_leads_network_is_not_visible(): void
    {
        [$root] = $this->threeGenerations();

        $this->agent(id: 20, userId: 120);
        $this->agent(id: 21, userId: 121, parentId: 20);

        $depths = $this->service()->teamDepths($root);

        $this->assertArrayNotHasKey(20, $depths, 'Another lead leaked into the team');
        $this->assertArrayNotHasKey(21, $depths, 'Another network leaked into the team');
    }

    public function test_a_parent_cycle_terminates_instead_of_walking_forever(): void
    {
        $root = $this->agent(id: 1, userId: 100);
        $this->agent(id: 2, userId: 101, parentId: 1);

        // parent_agent_id is writable with no FK-level cycle check, so bad data
        // can point a parent back at its own descendant.
        DB::table('lead_agents')->where('id', 1)->update(['parent_agent_id' => 2]);

        $this->assertSame([2 => 1], $this->service()->teamDepths($root));
    }

    // ── The viewer is never in their own figures ────────────────────────────

    public function test_the_viewers_own_work_is_excluded_from_every_figure(): void
    {
        [$root] = $this->threeGenerations();

        // A strong personal book on the root, and one modest team member.
        $this->commission(agentId: 1, amount: 9000, status: 'paid', paidAt: now());
        $this->commission(agentId: 1, amount: 4000, status: 'pending');
        $this->deal(id: 1, agentId: 1, open: true);
        $this->deal(id: 2, agentId: 1, open: false, wonAt: now());
        $this->lead(id: 1, ownerId: 100, contacted: true);

        $this->commission(agentId: 2, amount: 100, status: 'paid', paidAt: now());
        $this->deal(id: 3, agentId: 2, open: true);
        $this->lead(id: 2, ownerId: 101, contacted: true);

        $summary = $this->service()->summary($root, $this->range());

        // Every one of these would be dominated by the root's own numbers if
        // the exclusion regressed — which is exactly why it is worth pinning.
        $this->assertSame(100.0, $summary['paid']);
        $this->assertSame(0.0, $summary['pending']);
        $this->assertSame(1.0, $summary['active_deals']);
        $this->assertSame(0.0, $summary['deals_won']);
        $this->assertSame(1.0, $summary['leads_active']);
        $this->assertSame(4, $summary['agents']);
    }

    // ── Commission ──────────────────────────────────────────────────────────

    public function test_each_status_lands_in_its_own_bucket(): void
    {
        [$root] = $this->threeGenerations();

        $this->commission(agentId: 2, amount: 100, status: 'paid', paidAt: now());
        $this->commission(agentId: 2, amount: 40, status: 'pending');
        // Neither owed nor earned — a clawed-back leg must fall out of both.
        $this->commission(agentId: 2, amount: 999, status: 'reverted');

        $node = $this->nodeFor($this->service()->tree($root, $this->range()), 2);

        $this->assertSame(100.0, $node['own']['paid']);
        $this->assertSame(40.0, $node['own']['pending']);
    }

    public function test_the_houses_own_cut_is_never_shown_as_an_agents(): void
    {
        [$root] = $this->threeGenerations();

        $this->commission(agentId: 2, amount: 100, status: 'paid', paidAt: now());
        $this->commission(agentId: 2, amount: 900, status: 'paid', paidAt: now(), type: 'system');

        $node = $this->nodeFor($this->service()->tree($root, $this->range()), 2);

        $this->assertSame(100.0, $node['own']['paid'], 'A system leg was credited to an agent');
    }

    public function test_paid_respects_the_window_and_pending_deliberately_does_not(): void
    {
        [$root] = $this->threeGenerations();

        $this->commission(agentId: 2, amount: 100, status: 'paid', paidAt: now()->subDays(5));
        $this->commission(agentId: 2, amount: 500, status: 'paid', paidAt: now()->subDays(200));
        // A standing balance is not earned on a date — a lead asking what their
        // team is owed does not mean "owed since last month".
        $this->commission(agentId: 2, amount: 70, status: 'pending');

        $summary = $this->service()->summary($root, $this->range());

        $this->assertSame(100.0, $summary['paid']);
        $this->assertSame(70.0, $summary['pending']);

        $this->assertSame(
            600.0,
            $this->service()->summary($root, $this->range(365))['paid'],
            'A wider window did not reach the older payment'
        );
    }

    public function test_a_commission_paid_outside_the_team_is_not_counted(): void
    {
        [$root] = $this->threeGenerations();

        $this->agent(id: 20, userId: 120);
        $this->commission(agentId: 20, amount: 5000, status: 'paid', paidAt: now());

        $this->assertSame(0.0, $this->service()->summary($root, $this->range())['paid']);
    }

    // ── Deals and leads ─────────────────────────────────────────────────────

    public function test_active_deals_ignore_the_window_but_won_deals_respect_it(): void
    {
        [$root] = $this->threeGenerations();

        // Opened long before the window and still running: active today.
        $this->deal(id: 1, agentId: 2, open: true, createdAt: now()->subDays(400));
        $this->deal(id: 2, agentId: 2, open: false, wonAt: now()->subDay());
        $this->deal(id: 3, agentId: 2, open: false, wonAt: now()->subDays(300));

        $summary = $this->service()->summary($root, $this->range());

        $this->assertSame(1.0, $summary['active_deals']);
        $this->assertSame(1.0, $summary['deals_won']);
    }

    public function test_leads_split_into_being_worked_and_never_touched(): void
    {
        [$root] = $this->threeGenerations();

        $this->lead(id: 1, ownerId: 101, contacted: true);
        $this->lead(id: 2, ownerId: 101, contacted: true);
        $this->lead(id: 3, ownerId: 101, contacted: false);

        $summary = $this->service()->summary($root, $this->range());

        $this->assertSame(2.0, $summary['leads_active']);
        $this->assertSame(1.0, $summary['leads_untouched']);
    }

    public function test_a_finished_lead_is_not_in_play(): void
    {
        [$root] = $this->threeGenerations();

        $this->lead(id: 1, ownerId: 101, contacted: true);
        $this->lead(id: 2, ownerId: 101, contacted: true, status: 'converted');
        $this->lead(id: 3, ownerId: 101, contacted: true, status: 'lost');
        $this->lead(id: 4, ownerId: 101, contacted: true, status: 'not_fit');
        // An unrecognised status counts as open: under-claiming progress beats
        // inventing it.
        $this->lead(id: 5, ownerId: 101, contacted: true, status: 'qualifying');

        $this->assertSame(2.0, $this->service()->summary($root, $this->range())['leads_active']);
    }

    // ── The tree ────────────────────────────────────────────────────────────

    public function test_the_tree_nests_by_who_recruited_whom(): void
    {
        [$root] = $this->threeGenerations();

        $tree = $this->service()->tree($root, $this->range());

        // Root's direct reports are the top level; the rest hang off them.
        $this->assertSame([2, 3], array_column($tree['nodes'], 'agent_id'));

        $bo = $this->nodeFor($tree, 2);
        $this->assertSame([4], array_column($bo['children'], 'agent_id'));
        $this->assertSame([5], array_column($bo['children'][0]['children'], 'agent_id'));
    }

    public function test_a_branch_total_includes_its_head_and_everyone_under_them(): void
    {
        [$root] = $this->threeGenerations();

        $this->commission(agentId: 2, amount: 100, status: 'paid', paidAt: now());
        $this->commission(agentId: 4, amount: 30, status: 'paid', paidAt: now());
        $this->commission(agentId: 5, amount: 7, status: 'paid', paidAt: now());
        $this->deal(id: 1, agentId: 5, open: true);

        $bo = $this->nodeFor($this->service()->tree($root, $this->range()), 2);

        $this->assertSame(100.0, $bo['own']['paid'], 'Own should be this person alone');
        $this->assertSame(137.0, $bo['network']['paid'], 'Branch should include the two below');
        // Bo, Di and Eli.
        $this->assertSame(3, $bo['network']['agents']);
        $this->assertSame(0, $bo['own']['active_deals']);
        $this->assertSame(1, $bo['network']['active_deals']);
    }

    public function test_every_team_member_appears_exactly_once(): void
    {
        [$root] = $this->threeGenerations();

        $seen = [];
        $walk = function (array $nodes) use (&$walk, &$seen): void {
            foreach ($nodes as $node) {
                $seen[] = $node['agent_id'];
                $walk($node['children']);
            }
        };
        $walk($this->service()->tree($root, $this->range())['nodes']);

        sort($seen);
        $this->assertSame([2, 3, 4, 5], $seen);
    }

    // ── Growth ──────────────────────────────────────────────────────────────

    public function test_growth_counts_joins_per_month_on_top_of_who_was_already_there(): void
    {
        $root = $this->agent(id: 1, userId: 100);
        $this->agent(id: 2, userId: 101, parentId: 1, createdAt: now()->subMonths(6));
        $this->agent(id: 3, userId: 102, parentId: 1, createdAt: now()->subMonth());
        $this->agent(id: 4, userId: 103, parentId: 1, createdAt: now());

        $growth = $this->service()->growth($root, $this->range(90));
        $points = collect($growth['points']);

        // Agent 2 predates a 90-day window, so it is the running total's floor
        // rather than a join inside it.
        $this->assertSame(1, $growth['before']);
        $this->assertSame(2, $growth['joined']);
        $this->assertSame(3, $points->last()['total']);
        $this->assertSame(2, $points->sum('joined'));
    }

    public function test_growth_emits_a_zero_for_a_month_nobody_joined(): void
    {
        $root = $this->agent(id: 1, userId: 100);
        $this->agent(id: 2, userId: 101, parentId: 1, createdAt: now());

        $points = $this->service()->growth($root, $this->range(90))['points'];

        // A stall has to read as a flat line, not as a gap the eye closes over.
        $this->assertGreaterThanOrEqual(3, count($points));
        $this->assertContains(0, array_column($points, 'joined'));
    }

    // ── Forecast ────────────────────────────────────────────────────────────

    public function test_forecast_credits_the_agent_the_leg_would_pay(): void
    {
        [$root] = $this->threeGenerations();
        $this->deal(id: 1, agentId: 4, open: true);

        // A sub-agent's open deal pays them their own leg and an ancestor an
        // upline differential. Both are inside the team, on different nodes.
        $service = $this->service(legs: [
            ['agent_id' => 4, 'amount' => 800, 'type' => 'agent'],
            ['agent_id' => 2, 'amount' => 200, 'type' => 'upline'],
        ]);

        $tree = $service->tree($root, $this->range());

        $this->assertSame(800.0, $this->nodeFor($tree, 4)['own']['forecast']);
        $this->assertSame(200.0, $this->nodeFor($tree, 2)['own']['forecast']);

        $forecast = $service->teamForecast($root);
        $this->assertSame(1000.0, $forecast['amount']);
    }

    public function test_forecast_drops_legs_for_the_viewer_and_for_agents_outside_the_team(): void
    {
        [$root] = $this->threeGenerations();
        $this->agent(id: 20, userId: 120);
        $this->deal(id: 1, agentId: 4, open: true);

        // An upline leg can legitimately point at the viewer (root) or at an
        // ancestor above them. Neither is this team's to see, and neither may
        // inflate the total — that is what keeps the viewer's own exclusion
        // holding for forecast too.
        $service = $this->service(legs: [
            ['agent_id' => 4, 'amount' => 800, 'type' => 'agent'],
            ['agent_id' => 1, 'amount' => 150, 'type' => 'upline'],
            ['agent_id' => 20, 'amount' => 300, 'type' => 'upline'],
            ['agent_id' => 4, 'amount' => 100, 'type' => 'system'],
        ]);

        $this->assertSame(
            800.0,
            $service->teamForecast($root)['amount'],
            'A leg belonging to the viewer, an outsider, or the house was rolled in'
        );
    }

    public function test_a_closed_deal_is_not_forecast(): void
    {
        [$root] = $this->threeGenerations();
        $this->deal(id: 1, agentId: 4, open: false);

        $service = $this->service(legs: [
            ['agent_id' => 4, 'amount' => 800, 'type' => 'agent'],
        ]);

        $forecast = $service->teamForecast($root);

        $this->assertSame(0, $forecast['deal_count']);
        $this->assertSame(0.0, $forecast['amount']);
    }

    public function test_a_branchs_forecast_rolls_up_with_its_other_figures(): void
    {
        [$root] = $this->threeGenerations();
        $this->deal(id: 1, agentId: 5, open: true);

        $service = $this->service(legs: [
            ['agent_id' => 5, 'amount' => 50, 'type' => 'agent'],
            ['agent_id' => 4, 'amount' => 10, 'type' => 'upline'],
        ]);

        $bo = $this->nodeFor($service->tree($root, $this->range()), 2);

        // Bo (2) has no forecast of their own, but Di (4) and Eli (5) sit in
        // their branch, so the branch total has to carry both.
        $this->assertSame(0.0, $bo['own']['forecast']);
        $this->assertSame(60.0, $bo['network']['forecast']);
    }

    // ── Commission trend ─────────────────────────────────────────────────────

    public function test_commission_trend_buckets_paid_amounts_by_month(): void
    {
        [$root] = $this->threeGenerations();

        $this->commission(agentId: 2, amount: 100, status: 'paid', paidAt: now()->subMonth());
        $this->commission(agentId: 3, amount: 50, status: 'paid', paidAt: now()->subMonth());
        $this->commission(agentId: 4, amount: 30, status: 'paid', paidAt: now());
        // Pending has no date to plot and must not leak into a monthly total.
        $this->commission(agentId: 2, amount: 999, status: 'pending');

        $points = collect($this->service()->commissionTrend($root, $this->range(90))['points']);

        $this->assertSame(150.0, $points->firstWhere('period', now()->subMonth()->format('Y-m'))['amount']);
        $this->assertSame(30.0, $points->firstWhere('period', now()->format('Y-m'))['amount']);
    }

    public function test_commission_trend_emits_a_zero_for_a_quiet_month(): void
    {
        [$root] = $this->threeGenerations();
        $this->commission(agentId: 2, amount: 100, status: 'paid', paidAt: now());

        $points = $this->service()->commissionTrend($root, $this->range(90))['points'];

        $this->assertGreaterThanOrEqual(3, count($points));
        $this->assertContains(0.0, array_column($points, 'amount'));
    }

    public function test_commission_trend_excludes_the_viewer_and_the_house(): void
    {
        [$root] = $this->threeGenerations();
        $this->commission(agentId: 1, amount: 9000, status: 'paid', paidAt: now());
        $this->commission(agentId: 2, amount: 100, status: 'paid', paidAt: now(), type: 'system');
        $this->commission(agentId: 2, amount: 40, status: 'paid', paidAt: now());

        $points = collect($this->service()->commissionTrend($root, $this->range(90))['points']);

        $this->assertSame(40.0, $points->firstWhere('period', now()->format('Y-m'))['amount']);
    }

    // ── Recent commissions ───────────────────────────────────────────────────

    public function test_recent_commissions_are_newest_first_and_respect_the_limit(): void
    {
        [$root] = $this->threeGenerations();

        $this->commission(agentId: 2, amount: 10, status: 'paid', paidAt: now()->subDays(3), createdAt: now()->subDays(3));
        $this->commission(agentId: 3, amount: 20, status: 'paid', paidAt: now()->subDay(), createdAt: now()->subDay());
        $this->commission(agentId: 4, amount: 30, status: 'pending', createdAt: now());

        $rows = $this->service()->recentCommissions($root, limit: 2);

        $this->assertCount(2, $rows);
        $this->assertSame(30.0, $rows[0]['amount']);
        $this->assertSame(20.0, $rows[1]['amount']);
    }

    public function test_recent_commissions_include_reverted_legs_but_never_the_houses_cut(): void
    {
        [$root] = $this->threeGenerations();

        $this->commission(agentId: 2, amount: 40, status: 'reverted', createdAt: now());
        $this->commission(agentId: 2, amount: 900, status: 'paid', createdAt: now(), type: 'system');

        $rows = $this->service()->recentCommissions($root);

        $this->assertCount(1, $rows, 'A system leg reached the activity feed');
        $this->assertSame('reverted', $rows[0]['status']);
    }

    public function test_recent_commissions_are_scoped_to_the_team(): void
    {
        [$root] = $this->threeGenerations();
        $this->agent(id: 20, userId: 120);

        $this->commission(agentId: 1, amount: 9000, status: 'paid', createdAt: now());
        $this->commission(agentId: 20, amount: 5000, status: 'paid', createdAt: now());
        $this->commission(agentId: 2, amount: 40, status: 'paid', createdAt: now());

        $rows = $this->service()->recentCommissions($root);

        $this->assertCount(1, $rows, 'The viewer\'s own commission, or an outsider\'s, leaked into the feed');
        $this->assertSame(40.0, $rows[0]['amount']);
    }

    public function test_recent_commission_rows_carry_agent_and_deal_names(): void
    {
        [$root] = $this->threeGenerations();
        $this->deal(id: 1, agentId: 2, open: true);
        DB::table('deals')->where('id', 1)->update(['name' => 'Dubai Marina A-1204']);
        $this->commission(agentId: 2, amount: 40, status: 'paid', createdAt: now(), dealId: 1);

        $row = $this->service()->recentCommissions($root)[0];

        $this->assertSame('Bo Direct', $row['agent_name']);
        $this->assertSame('Dubai Marina A-1204', $row['deal_name']);
    }

    // ── Fixtures ────────────────────────────────────────────────────────────

    /**
     * A three-generation network rooted at agent 1:
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
        $levels = Mockery::mock(LevelService::class);
        $levels->shouldReceive('getCurrentLevel')->andReturn(null);

        $commissions = Mockery::mock(MlmCommissionService::class);
        $commissions->shouldReceive('preview')->andReturn($legs);

        return new TeamDownlineService(app(HierarchyService::class), $levels, $commissions);
    }

    private function range(int $days = 30): DashboardDateRange
    {
        return DashboardDateRange::preset($days);
    }

    /** Find one agent's node anywhere in the tree. */
    private function nodeFor(array $tree, int $agentId): array
    {
        $find = function (array $nodes) use (&$find, $agentId): ?array {
            foreach ($nodes as $node) {
                if ($node['agent_id'] === $agentId) {
                    return $node;
                }

                if ($hit = $find($node['children'])) {
                    return $hit;
                }
            }

            return null;
        };

        $node = $find($tree['nodes']);
        $this->assertNotNull($node, "Agent {$agentId} is missing from the tree");

        return $node;
    }

    private function agent(
        int $id,
        int $userId,
        ?int $parentId = null,
        string $name = 'Agent',
        $createdAt = null
    ): LeadAgent {
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
            'created_at' => $createdAt ?? now()->subYear(),
            'updated_at' => now(),
        ]);

        return LeadAgent::find($id);
    }

    private function commission(
        int $agentId,
        float $amount,
        string $status,
        $paidAt = null,
        string $type = 'agent',
        $createdAt = null,
        ?int $dealId = null
    ): void {
        DB::table('mlm_commissions')->insert([
            'company_id' => $this->companyId,
            'agent_id' => $agentId,
            'deal_id' => $dealId,
            'amount' => $amount,
            'status' => $status,
            'type' => $type,
            'paid_at' => $paidAt,
            'created_at' => $createdAt ?? now(),
            'updated_at' => now(),
        ]);
    }

    private function deal(
        int $id,
        int $agentId,
        bool $open,
        $wonAt = null,
        $createdAt = null
    ): void {
        DB::table('deals')->insert([
            'id' => $id,
            'company_id' => $this->companyId,
            'name' => "Deal {$id}",
            'agent_id' => $agentId,
            'outcome_status' => $open ? null : 'won',
            'won_at' => $wonAt,
            'created_at' => $createdAt ?? now(),
            'updated_at' => $wonAt ?? now(),
        ]);
    }

    private function lead(
        int $id,
        int $ownerId,
        bool $contacted,
        ?string $status = null
    ): void {
        DB::table('leads')->insert([
            'id' => $id,
            'company_id' => $this->companyId,
            'client_name' => "Lead {$id}",
            'lead_owner' => $ownerId,
            'first_contacted_at' => $contacted ? now()->subDay() : null,
            'lead_lifecycle_status_id' => $status ? $this->statusId($status) : null,
            'created_at' => now()->subDays(5),
            'updated_at' => now(),
        ]);
    }

    private function statusId(string $key): int
    {
        $existing = DB::table('lead_lifecycle_statuses')->where('key', $key)->value('id');

        return $existing ?? DB::table('lead_lifecycle_statuses')->insertGetId([
            'company_id' => $this->companyId,
            'key' => $key,
            'label' => ucfirst($key),
        ]);
    }

    private function resetSchema(): void
    {
        foreach ([
            'mlm_commissions', 'deals', 'leads', 'lead_lifecycle_statuses',
            'agent_hierarchy', 'lead_agents', 'users', 'companies',
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

        Schema::create('lead_lifecycle_statuses', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('key');
            $table->string('label')->nullable();
            $table->timestamps();
        });

        Schema::create('leads', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('client_name');
            $table->unsignedInteger('lead_owner')->nullable();
            $table->unsignedInteger('lead_lifecycle_status_id')->nullable();
            $table->timestamp('first_contacted_at')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });

        Schema::create('deals', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name');
            $table->unsignedInteger('agent_id')->nullable();
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
