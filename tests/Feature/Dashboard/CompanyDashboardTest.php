<?php

namespace Tests\Feature\Dashboard;

use App\Enums\MlmCommissionType;
use App\Http\Controllers\DashboardV2Controller;
use App\Models\Deal;
use App\Models\Lead;
use App\Models\LeadAgent;
use App\Models\MlmCommission;
use App\Services\Dashboard\DashboardMetricsService;
use App\Services\Dashboard\TeamDownlineService;
use App\Services\MlmCommissionService;
use App\Support\DashboardDateRange;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Mockery;
use ReflectionMethod;
use Tests\Concerns\SetsFeatureFlags;
use Tests\TestCase;

/**
 * The company view (?view=leadership): revenue, commission and the headline
 * counts, and the crm.company-dashboard gate on its switcher tab.
 *
 * Every figure is a straight aggregate over the CRM's own rows, so each test
 * pins one against a hand-computed sum.
 */
class CompanyDashboardTest extends TestCase
{
    use SetsFeatureFlags;

    private int $companyId = 1;

    protected function setUp(): void
    {
        parent::setUp();

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');

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

    // ── Revenue ──────────────────────────────────────────────────

    public function test_a_won_deal_counts_in_the_period_it_was_won_not_when_it_was_last_edited(): void
    {
        // Won four months ago, touched today.
        $this->deal(value: 100000, wonAt: now()->subMonths(4), updatedAt: now());
        // Won this week.
        $this->deal(value: 250000, wonAt: now()->subDays(3));

        $revenue = $this->metrics()->wonRevenue(DashboardDateRange::preset(30));

        $this->assertSame(1, $revenue['deal_count']);
        $this->assertSame(250000.0, $revenue['total']);
    }

    public function test_a_deal_with_no_won_at_falls_back_to_updated_at(): void
    {
        $this->deal(value: 80000, wonAt: null, updatedAt: now()->subDays(2));

        $revenue = $this->metrics()->wonRevenue(DashboardDateRange::preset(30));

        $this->assertSame(1, $revenue['deal_count']);
        $this->assertSame(80000.0, $revenue['total']);
    }

    public function test_revenue_is_converted_into_the_company_currency_by_each_deals_own_rate(): void
    {
        $this->deal(value: 100000, wonAt: now()->subDays(1), exchangeRate: 1.0);
        // A foreign-currency deal snapshotted at 0.5 to the company currency.
        $this->deal(value: 1000000, wonAt: now()->subDays(1), exchangeRate: 0.5);
        // No stored rate is taken at 1, as the commission engine does.
        $this->deal(value: 20000, wonAt: now()->subDays(1), exchangeRate: null);

        $revenue = $this->metrics()->wonRevenue(DashboardDateRange::preset(30));

        $this->assertSame(620000.0, $revenue['total']);
        $this->assertSame(3, $revenue['deal_count']);
    }

    public function test_revenue_compares_against_the_window_just_before(): void
    {
        $this->deal(value: 50000, wonAt: now()->subDays(5));
        $this->deal(value: 30000, wonAt: now()->subDays(40));
        // Older than both windows.
        $this->deal(value: 999999, wonAt: now()->subDays(90));

        $revenue = $this->metrics()->wonRevenue(DashboardDateRange::preset(30));

        $this->assertSame(50000.0, $revenue['total']);
        $this->assertSame(30000.0, $revenue['previous']);
        $this->assertSame(1, $revenue['previous_count']);
    }

    public function test_all_time_has_no_previous_window(): void
    {
        $this->deal(value: 50000, wonAt: now()->subYears(3));

        $revenue = $this->metrics()->wonRevenue(DashboardDateRange::named('all'));

        $this->assertSame(50000.0, $revenue['total']);
        $this->assertNull($revenue['previous']);
        $this->assertNull($revenue['previous_count']);
    }

    public function test_open_and_lost_deals_are_not_revenue(): void
    {
        $this->deal(value: 70000, wonAt: null, outcome: null);
        $this->deal(value: 70000, wonAt: null, outcome: 'lost');

        $revenue = $this->metrics()->wonRevenue(DashboardDateRange::preset(30));

        $this->assertSame(0, $revenue['deal_count']);
        $this->assertSame(0.0, $revenue['total']);
    }

    public function test_the_monthly_trend_buckets_by_won_at_and_adds_up(): void
    {
        $this->deal(value: 100000, wonAt: now()->startOfMonth()->addDay(), updatedAt: now());
        $this->deal(value: 40000, wonAt: now()->subMonthNoOverflow()->startOfMonth()->addDays(2), updatedAt: now());

        $trend = $this->metrics()->wonRevenueTrend(DashboardDateRange::preset(30));
        $points = collect($trend['points'])->keyBy('period');

        $this->assertCount(12, $trend['points'], 'A short window still reads a year of movement');
        $this->assertSame(100000.0, $points[now()->format('Y-m')]['total']);
        $this->assertSame(40000.0, $points[now()->subMonthNoOverflow()->format('Y-m')]['total']);
        $this->assertSame(140000.0, (float) collect($trend['points'])->sum('total'));
    }

    // ── Commission ───────────────────────────────────────────────

    public function test_commission_totals_reconcile_with_the_payable_rows(): void
    {
        $agent = $this->agent();

        $this->commission($agent, 1000, 'paid', MlmCommissionType::Agent, paidAt: now()->subDays(3));
        $this->commission($agent, 400, 'paid', MlmCommissionType::Upline, paidAt: now()->subDays(10));
        // Paid outside the window.
        $this->commission($agent, 700, 'paid', MlmCommissionType::Agent, paidAt: now()->subDays(45));
        // Pending is a standing balance, however old.
        $this->commission($agent, 250, 'pending', MlmCommissionType::Agent, createdAt: now()->subYear());
        // Clawed back in the window: reported, never counted.
        $this->commission($agent, 90, 'reverted', MlmCommissionType::Agent, revertedAt: now()->subDays(2));
        // The house's retained cut is not a payout.
        $this->commission($agent, 5000, 'paid', MlmCommissionType::System, paidAt: now()->subDays(3));
        $this->commission($agent, 5000, 'pending', MlmCommissionType::System);

        $commission = $this->metrics()->companyCommission(DashboardDateRange::preset(30));

        $this->assertSame(1400.0, $commission['paid']);
        $this->assertSame(700.0, $commission['previous_paid']);
        $this->assertSame(250.0, $commission['pending']);
        $this->assertSame(90.0, $commission['reverted']);
    }

    public function test_the_forecast_prices_open_deals_without_the_system_leg_and_caps_like_the_team_view(): void
    {
        $agent = $this->agent();

        foreach (range(1, TeamDownlineService::FORECAST_MAX_DEALS + 2) as $_) {
            $this->deal(value: 100000, wonAt: null, outcome: null, agentId: $agent);
        }

        $engine = Mockery::mock(MlmCommissionService::class);
        $engine->shouldReceive('preview')
            ->times(TeamDownlineService::FORECAST_MAX_DEALS)
            ->andReturn([
                ['agent_id' => $agent, 'type' => MlmCommissionType::Agent->value, 'amount' => 30.0],
                ['agent_id' => $agent, 'type' => MlmCommissionType::System->value, 'amount' => 70.0],
            ]);

        $forecast = $this->metrics()->companyForecast($engine);

        $this->assertSame(TeamDownlineService::FORECAST_MAX_DEALS * 30.0, $forecast['amount']);
        $this->assertSame(TeamDownlineService::FORECAST_MAX_DEALS, $forecast['deal_count']);
        $this->assertSame(TeamDownlineService::FORECAST_MAX_DEALS + 2, $forecast['open_deals']);
        $this->assertTrue($forecast['truncated']);
    }

    // ── Headline counts ──────────────────────────────────────────

    public function test_win_rate_is_won_over_decided_in_the_window(): void
    {
        $this->deal(value: 1, wonAt: now()->subDays(2));
        $this->deal(value: 1, wonAt: null, outcome: 'lost', updatedAt: now()->subDays(4));
        $this->deal(value: 1, wonAt: null, outcome: 'lost', updatedAt: now()->subDays(6));
        $this->deal(value: 1, wonAt: null, outcome: 'lost', updatedAt: now()->subDays(8));
        // Decided before the window — neither side of this one's rate.
        $this->deal(value: 1, wonAt: null, outcome: 'lost', updatedAt: now()->subDays(50));

        $headline = $this->metrics()->companyHeadline(DashboardDateRange::preset(30));

        $this->assertSame(25.0, $headline['win_rate']['value']);
        $this->assertSame(1, $headline['win_rate']['won']);
        $this->assertSame(3, $headline['win_rate']['lost']);
        $this->assertSame(0.0, $headline['win_rate']['previous']);
    }

    public function test_time_to_close_runs_from_the_lead_coming_in_to_the_win(): void
    {
        $lead = Lead::insertGetId([
            'company_id' => $this->companyId,
            'client_name' => 'Buyer',
            'created_at' => now()->subDays(50),
            'updated_at' => now(),
        ]);

        $this->deal(value: 1, wonAt: now()->subDays(2), leadId: $lead, createdAt: now()->subDays(20));

        $headline = $this->metrics()->companyHeadline(DashboardDateRange::preset(30));

        $this->assertSame(48, $headline['days_to_win']['value']);
        $this->assertSame(1, $headline['new_leads']['previous'], 'The lead itself was created in the previous window');
    }

    public function test_the_company_payloads_carry_no_agent_identity(): void
    {
        $agent = $this->agent();
        $this->deal(value: 100000, wonAt: now()->subDays(1), agentId: $agent);
        $this->commission($agent, 100, 'paid', MlmCommissionType::Agent, paidAt: now()->subDay());

        $range = DashboardDateRange::preset(30);
        $metrics = $this->metrics();

        $payload = json_encode([
            $metrics->wonRevenue($range),
            $metrics->wonRevenueTrend($range),
            $metrics->companyCommission($range),
        ]);

        $this->assertStringNotContainsString('agent_id', $payload);
        $this->assertStringNotContainsString('"name"', $payload);
    }

    // ── Gate ─────────────────────────────────────────────────────

    public function test_with_the_flag_off_the_company_tab_is_coming_soon(): void
    {
        $this->setFeatureFlag('crm.company-dashboard', false);

        $this->assertSame(['leadership'], $this->comingSoon(['manager', 'leadership']));
    }

    public function test_with_the_flag_on_the_company_tab_opens(): void
    {
        $this->setFeatureFlag('crm.company-dashboard', true);

        $this->assertSame([], $this->comingSoon(['manager', 'leadership']));
    }

    public function test_an_account_without_the_company_view_gets_no_greyed_tab(): void
    {
        $this->setFeatureFlag('crm.company-dashboard', false);

        $this->assertSame([], $this->comingSoon(['manager', 'team']));
    }

    // ── Fixtures ─────────────────────────────────────────────────

    private function metrics(): DashboardMetricsService
    {
        return app(DashboardMetricsService::class);
    }

    /** @param  array<int, string>  $available */
    private function comingSoon(array $available): array
    {
        $method = new ReflectionMethod(DashboardV2Controller::class, 'comingSoonViews');
        $method->setAccessible(true);

        $controller = (new \ReflectionClass(DashboardV2Controller::class))
            ->newInstanceWithoutConstructor();

        return $method->invoke($controller, $available);
    }

    private function agent(): int
    {
        return LeadAgent::insertGetId([
            'company_id' => $this->companyId,
            'user_id' => 1,
            'created_at' => now()->subYear(),
        ]);
    }

    private function deal(
        float $value,
        $wonAt,
        $updatedAt = null,
        ?string $outcome = 'won',
        ?float $exchangeRate = 1.0,
        ?int $agentId = null,
        ?int $leadId = null,
        $createdAt = null,
    ): int {
        return Deal::insertGetId([
            'company_id' => $this->companyId,
            'agent_id' => $agentId,
            'lead_id' => $leadId,
            'value' => $value,
            'exchange_rate' => $exchangeRate,
            'outcome_status' => $outcome,
            'won_at' => $wonAt,
            'created_at' => $createdAt ?? now()->subYear(),
            'updated_at' => $updatedAt ?? $wonAt ?? now(),
        ]);
    }

    private function commission(
        int $agentId,
        float $amount,
        string $status,
        MlmCommissionType $type,
        $paidAt = null,
        $revertedAt = null,
        $createdAt = null,
    ): void {
        MlmCommission::insert([
            'company_id' => $this->companyId,
            'agent_id' => $agentId,
            'amount' => $amount,
            'status' => $status,
            'type' => $type->value,
            'paid_at' => $paidAt,
            'reverted_at' => $revertedAt,
            'created_at' => $createdAt ?? now(),
            'updated_at' => now(),
        ]);
    }

    private function resetSchema(): void
    {
        Schema::dropIfExists('mlm_commissions');
        Schema::dropIfExists('deals');
        Schema::dropIfExists('lead_agents');
        Schema::dropIfExists('leads');
        Schema::dropIfExists('users');
        Schema::dropIfExists('companies');
    }

    private function createMinimalSchema(): void
    {
        Schema::create('companies', function (Blueprint $table) {
            $table->increments('id');
            $table->string('company_name')->nullable();
            $table->timestamps();
        });

        Schema::create('users', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name')->nullable();
            $table->string('status')->default('active');
            $table->timestamps();
        });

        Schema::create('leads', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('client_name');
            $table->softDeletes();
            $table->timestamps();
        });

        Schema::create('deals', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('lead_id')->nullable();
            $table->unsignedInteger('agent_id')->nullable();
            $table->decimal('value', 15, 2)->nullable();
            $table->double('exchange_rate')->nullable();
            $table->string('outcome_status')->nullable();
            $table->timestamp('won_at')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });

        Schema::create('lead_agents', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('user_id')->nullable();
            $table->string('status')->default('enabled');
            $table->timestamps();
        });

        Schema::create('mlm_commissions', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('agent_id')->nullable();
            $table->decimal('amount', 15, 2)->default(0);
            $table->string('status')->nullable();
            $table->string('type')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->timestamp('reverted_at')->nullable();
            $table->timestamps();
        });

        DB::table('companies')->insert(['id' => $this->companyId, 'company_name' => 'Test']);
    }
}
