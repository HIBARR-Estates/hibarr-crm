<?php

namespace Tests\Feature\AgentWorkspace;

use App\Enums\MlmCommissionStatus;
use App\Enums\MlmCommissionType;
use App\Http\Controllers\AgentWorkspace\EarningsController;
use App\Http\Controllers\AgentWorkspace\MyReportController;
use App\Http\Middleware\EnsureAgentWorkspaceAccess;
use App\Models\Deal;
use App\Models\Lead;
use App\Models\LeadAgent;
use App\Models\MlmCommission;
use App\Models\MlmCommissionDispute;
use App\Models\Package;
use App\Models\User;
use App\Services\AgentWorkspace\EarningsPresenter;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * Earnings: Overview, Ledger and Network at /agent/earnings. They run on the
 * Affiliate module's own commissions, disputes, levels, cycles and hierarchy,
 * so what is checked here is the wiring, that the lists stay out of the first
 * paint, and the shapes the screens read.
 */
class AgentWorkspaceEarningsTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');
        DB::purge('sqlite');
        DB::reconnect('sqlite');

        foreach (['lead_agents', 'companies', 'currencies'] as $table) {
            Schema::dropIfExists($table);
        }
        Schema::create('currencies', function (Blueprint $table) {
            $table->increments('id');
            $table->string('currency_symbol')->nullable();
            $table->string('currency_code')->nullable();
            $table->timestamps();
        });
        Schema::create('companies', function (Blueprint $table) {
            $table->increments('id');
            $table->string('company_name')->nullable();
            $table->unsignedInteger('currency_id')->nullable();
            $table->timestamps();
        });
        DB::table('currencies')->insert(['id' => 1, 'currency_symbol' => '€', 'currency_code' => 'EUR']);
        DB::table('companies')->insert(['id' => 1, 'company_name' => 'HIBARR', 'currency_id' => 1]);
        Schema::create('lead_agents', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('user_id')->nullable();
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('parent_agent_id')->nullable();
            $table->timestamps();
        });
    }

    protected function tearDown(): void
    {
        session()->forget('user');
        parent::tearDown();
    }

    public function test_the_three_views_and_the_panel_are_registered_behind_the_workspace_gate(): void
    {
        $actions = ['earnings' => 'overview', 'earnings.ledger' => 'ledger', 'earnings.network' => 'network', 'earnings.network.agent' => 'agentPanel'];

        foreach ($actions as $name => $action) {
            $route = Route::getRoutes()->getByName('agent.'.$name);

            $this->assertNotNull($route, "agent.{$name} is missing");
            $this->assertSame(EarningsController::class.'@'.$action, $route->getActionName());
            $this->assertContains(EnsureAgentWorkspaceAccess::class, $route->gatherMiddleware());
            $this->assertContains('auth', $route->gatherMiddleware());
        }

        $this->assertStringEndsWith('/agent/earnings/network/12', route('agent.earnings.network.agent', 12, false));
    }

    public function test_my_report_and_its_period_endpoint_are_registered_behind_the_workspace_gate(): void
    {
        $actions = ['earnings.report' => 'show', 'earnings.report.kpi' => 'kpiFor'];

        foreach ($actions as $name => $action) {
            $route = Route::getRoutes()->getByName('agent.'.$name);

            $this->assertNotNull($route, "agent.{$name} is missing");
            $this->assertSame(MyReportController::class.'@'.$action, $route->getActionName());
            $this->assertContains(EnsureAgentWorkspaceAccess::class, $route->gatherMiddleware());
            $this->assertContains('auth', $route->gatherMiddleware());
        }

        $this->assertStringEndsWith('/agent/earnings/report', route('agent.earnings.report', [], false));
    }

    public function test_the_dock_opens_earnings_on_the_agent_page(): void
    {
        $destinations = file_get_contents(base_path('resources/js/Components/Redesign/agent/destinations.ts'));

        $this->assertStringContainsString('segment: "earnings", href: "/agent/earnings"', $destinations);
    }

    public function test_the_dispute_goes_through_the_affiliate_modules_own_endpoint(): void
    {
        $route = Route::getRoutes()->getByName('mlm.agent.api.commissions.dispute');

        $this->assertNotNull($route);
        $this->assertSame(\App\Http\Controllers\MlmAgentController::class.'@disputeCommissionApi', $route->getActionName());
    }

    public function test_the_overview_sends_a_light_shell_and_defers_its_data(): void
    {
        $page = $this->visit('overview');

        $this->assertSame('AgentWorkspace/Earnings', $page['component']);
        $this->assertSame('overview', $page['props']['view']);
        $this->assertTrue($page['props']['isAgent']);
        $this->assertSame(now()->startOfMonth()->toDateString(), $page['props']['month']);

        foreach (['summary', 'latest', 'level'] as $deferred) {
            $this->assertArrayNotHasKey($deferred, $page['props'], "{$deferred} must not block the first paint");
            $this->assertContains($deferred, $page['deferredProps'][$deferred] ?? []);
        }
    }

    public function test_the_ledger_defers_its_lines_and_names_the_year(): void
    {
        $page = $this->visit('ledger');

        $this->assertSame('ledger', $page['props']['view']);
        $this->assertSame(now()->year, $page['props']['year']);
        $this->assertArrayNotHasKey('ledger', $page['props']);
        $this->assertContains('ledger', $page['deferredProps']['ledger'] ?? []);
    }

    public function test_the_network_defers_its_rows_and_knows_who_the_agent_is(): void
    {
        $page = $this->visit('network');

        $this->assertSame('network', $page['props']['view']);
        $this->assertSame(1, $page['props']['selfId']);
        $this->assertArrayNotHasKey('network', $page['props']);
        $this->assertContains('network', $page['deferredProps']['network'] ?? []);
    }

    public function test_someone_without_an_agent_profile_is_told_so_and_nothing_is_loaded(): void
    {
        $page = $this->visit('overview', agent: false);

        $this->assertFalse($page['props']['isAgent']);
    }

    public function test_the_panel_is_only_for_the_agents_own_downline(): void
    {
        $this->signIn();
        DB::statement('create table agent_hierarchy (id integer primary key, ancestor_id integer, descendant_id integer, depth integer)');

        $controller = new class extends EarningsController
        {
            public function __construct() {}
        };

        try {
            $controller->agentPanel(99);
            $this->fail('A stranger must not be opened.');
        } catch (\Symfony\Component\HttpKernel\Exception\HttpException $e) {
            $this->assertSame(403, $e->getStatusCode());
        }
    }

    public function test_an_own_pending_line_can_be_disputed_and_reads_back_its_package_and_how_it_was_earned(): void
    {
        $line = EarningsPresenter::commission($this->commission(['status' => 'pending', 'type' => 'agent']), collect(), false);

        $this->assertSame('pending', $line['status']);
        $this->assertTrue($line['own']);
        $this->assertTrue($line['can_dispute']);
        $this->assertFalse($line['disputed']);
        $this->assertSame('Legal Service', $line['package']);
        $this->assertSame('Klaus Weber', $line['person']);
        $this->assertSame('Weber · Kyrenia apartment', $line['deal_name']);
        $this->assertSame(1080.0, $line['amount']);
    }

    public function test_a_paid_line_and_a_downline_line_offer_no_dispute(): void
    {
        $paid = EarningsPresenter::commission($this->commission(['status' => 'paid', 'type' => 'agent']), collect(), false);
        $downline = EarningsPresenter::commission($this->commission(['status' => 'pending', 'type' => 'upline']), collect(), false);

        $this->assertFalse($paid['can_dispute']);
        $this->assertFalse($downline['can_dispute']);
        $this->assertFalse($downline['own']);
        $this->assertSame('Daniel Ruf', $downline['from_agent']);
    }

    public function test_an_open_dispute_marks_the_line_disputed_and_hands_over_the_dispute(): void
    {
        $commission = $this->commission(['status' => 'pending', 'type' => 'agent']);
        $dispute = new MlmCommissionDispute(['reason' => 'Rate', 'message' => 'Rate should be 30%', 'status' => MlmCommissionDispute::STATUS_OPEN]);
        $dispute->id = 9;

        $line = EarningsPresenter::commission($commission, collect([$commission->id => $dispute]), false);

        $this->assertTrue($line['disputed']);
        $this->assertFalse($line['can_dispute']);
        $this->assertSame('Rate should be 30%', $line['dispute']['message']);
        $this->assertSame(9, $line['dispute']['id']);
    }

    public function test_a_resolved_dispute_leaves_the_line_open_to_a_new_one(): void
    {
        $commission = $this->commission(['status' => 'pending', 'type' => 'agent']);
        $dispute = new MlmCommissionDispute(['status' => MlmCommissionDispute::STATUS_RESOLVED, 'resolution_note' => 'Corrected']);
        $dispute->id = 4;

        $line = EarningsPresenter::commission($commission, collect([$commission->id => $dispute]), false);

        $this->assertFalse($line['disputed']);
        $this->assertTrue($line['can_dispute']);
        $this->assertSame('Corrected', $line['dispute']['resolution_note']);
    }

    public function test_a_partner_never_sees_the_clients_name(): void
    {
        $line = EarningsPresenter::commission($this->commission(['status' => 'pending', 'type' => 'agent']), collect(), true);

        $this->assertNull($line['person']);
        $this->assertSame('Weber · Kyrenia apartment', $line['deal_name']);
    }

    public function test_the_status_values_the_screens_read_are_the_commission_modules_own(): void
    {
        $this->assertSame(['pending', 'paid', 'reverted'], MlmCommissionStatus::toArray());
        $this->assertContains('upline', MlmCommissionType::toArray());
    }

    /** Builds a commission with its relations set, so nothing needs a database. */
    private function commission(array $attributes): MlmCommission
    {
        $commission = new MlmCommission(array_merge(['amount' => 1080, 'deal_id' => 31, 'agent_id' => 1], $attributes));
        $commission->id = 77;
        $commission->created_at = Carbon::parse('2026-11-04 10:00');

        $contact = new Lead;
        $contact->client_name = 'Klaus Weber';
        $deal = new Deal(['name' => 'Weber · Kyrenia apartment']);
        $deal->id = 31;
        $deal->lead_id = 12;
        $deal->setRelation('contact', $contact);
        $commission->setRelation('deal', $deal);

        $package = new Package(['name' => 'Legal Service']);
        $commission->setRelation('package', $package);

        $closer = new LeadAgent;
        $closer->setRelation('user', new User(['name' => 'Daniel Ruf']));
        $commission->setRelation('sourceAgent', $closer);

        return $commission;
    }

    private function signIn(bool $agent = true): void
    {
        $user = new class extends User {};
        $user->id = 5;
        $user->company_id = 1;
        session(['user' => $user]);

        if ($agent) {
            LeadAgent::withoutGlobalScopes()->insert(['id' => 1, 'user_id' => 5, 'company_id' => 1]);
        }
    }

    private function visit(string $action, bool $agent = true): array
    {
        $this->signIn($agent);

        $request = Request::create('/agent/earnings');
        $request->headers->set('X-Inertia', 'true');
        $this->app->instance('request', $request);

        $controller = new class extends EarningsController
        {
            public function __construct() {}
        };

        return $controller->{$action}()->toResponse($request)->getData(true);
    }
}
