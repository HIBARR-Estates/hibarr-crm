<?php

namespace Tests\Feature\Dashboard;

use App\Enums\MlmCommissionType;
use App\Models\Deal;
use App\Models\Lead;
use App\Models\LeadAgent;
use App\Models\MlmCommission;
use App\Services\Dashboard\DashboardMetricsService;
use App\Services\MlmCommissionService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Mockery;
use Tests\TestCase;

/**
 * The partner dashboard's money figures must equal the mlm_commissions rows —
 * and the forecast what distribute() would write — for that partner.
 *
 * The trap both figures fell into: a System leg (the house's retained cut) is
 * written with agent_id set to the deal's own agent. A partner who also sold a
 * deal therefore "owned" the company's margin in an agent_id-only query, and
 * saw it in their ledger and their forecast.
 */
class PartnerCommissionReconciliationTest extends TestCase
{
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

    public function test_ledger_totals_match_the_partners_payable_commission_rows(): void
    {
        $partner = $this->makeAgent(userId: 10);
        $other = $this->makeAgent(userId: 11);

        $this->commission($partner, 1200, 'paid', MlmCommissionType::Agent);
        $this->commission($partner, 300, 'paid', MlmCommissionType::Upline);
        $this->commission($partner, 450.5, 'pending', MlmCommissionType::Agent);
        $this->commission($partner, 80, 'reverted', MlmCommissionType::Agent);
        // The house's cut on a deal the partner sold — not theirs.
        $this->commission($partner, 999, 'paid', MlmCommissionType::System);
        $this->commission($partner, 111, 'pending', MlmCommissionType::System);
        // Another agent's money never reaches this partner's ledger.
        $this->commission($other, 5000, 'paid', MlmCommissionType::Agent);

        $byStatus = $this->metrics()->partnerStats($partner)['commissionsByStatus'];

        $expected = MlmCommission::query()
            ->where('agent_id', $partner)
            ->whereIn('type', [MlmCommissionType::Agent->value, MlmCommissionType::Upline->value])
            ->toBase()
            ->get(['status', 'amount'])
            ->groupBy('status')
            ->map(fn ($rows) => (float) $rows->sum('amount'))
            ->all();

        $this->assertEqualsCanonicalizing($expected, $byStatus);
        $this->assertSame(1500.0, $byStatus['paid']);
        $this->assertSame(450.5, $byStatus['pending']);
        $this->assertSame(80.0, $byStatus['reverted']);
    }

    public function test_forecast_sums_only_the_legs_distribute_would_pay_the_partner(): void
    {
        $partner = $this->makeAgent(userId: 20);
        $upline = $this->makeAgent(userId: 21);

        foreach (range(1, 3) as $_) {
            $this->openReferredDeal($partner, sellerAgentId: $partner);
        }

        $engine = Mockery::mock(MlmCommissionService::class);
        $engine->shouldReceive('preview')->andReturn([
            ['agent_id' => $partner, 'type' => MlmCommissionType::Agent->value, 'amount' => 100.0],
            ['agent_id' => $upline, 'type' => MlmCommissionType::Upline->value, 'amount' => 40.0],
            // Addressed to the seller — the partner here — but the house's.
            ['agent_id' => $partner, 'type' => MlmCommissionType::System->value, 'amount' => 60.0],
        ]);

        $forecast = $this->metrics()->partnerForecast($partner, $engine);

        $this->assertSame(3, $forecast['deal_count']);
        $this->assertFalse($forecast['suppressed']);
        $this->assertSame(300.0, $forecast['amount'], 'Forecast included a System leg or another agent\'s leg');
    }

    public function test_forecast_ignores_won_deals_and_other_partners_referrals(): void
    {
        $partner = $this->makeAgent(userId: 30);
        $other = $this->makeAgent(userId: 31);

        foreach (range(1, 3) as $_) {
            $this->openReferredDeal($partner, sellerAgentId: $other);
        }

        // Already won: its commission lives in mlm_commissions, not the forecast.
        $this->openReferredDeal($partner, sellerAgentId: $other, outcome: 'won');
        // Someone else's referral.
        $this->openReferredDeal($other, sellerAgentId: $other);

        $engine = Mockery::mock(MlmCommissionService::class);
        $engine->shouldReceive('preview')->times(3)->andReturn([
            ['agent_id' => $partner, 'type' => MlmCommissionType::Agent->value, 'amount' => 25.0],
        ]);

        $forecast = $this->metrics()->partnerForecast($partner, $engine);

        $this->assertSame(3, $forecast['deal_count']);
        $this->assertSame(75.0, $forecast['amount']);
    }

    private function metrics(): DashboardMetricsService
    {
        return app(DashboardMetricsService::class);
    }

    private function makeAgent(int $userId): int
    {
        return LeadAgent::insertGetId([
            'company_id' => $this->companyId,
            'user_id' => $userId,
        ]);
    }

    private function commission(int $agentId, float $amount, string $status, MlmCommissionType $type): void
    {
        MlmCommission::insert([
            'company_id' => $this->companyId,
            'agent_id' => $agentId,
            'amount' => $amount,
            'status' => $status,
            'type' => $type->value,
        ]);
    }

    private function openReferredDeal(int $partnerId, int $sellerAgentId, ?string $outcome = null): int
    {
        $leadId = Lead::insertGetId([
            'company_id' => $this->companyId,
            'client_name' => 'Referred client',
            'referred_by_agent_id' => $partnerId,
            'created_at' => now()->subMonths(2),
            'updated_at' => now(),
        ]);

        return Deal::insertGetId([
            'company_id' => $this->companyId,
            'lead_id' => $leadId,
            'agent_id' => $sellerAgentId,
            'value' => 100000,
            'outcome_status' => $outcome,
            'won_at' => $outcome === 'won' ? now() : null,
            'created_at' => now()->subMonth(),
            'updated_at' => now(),
        ]);
    }

    private function resetSchema(): void
    {
        Schema::dropIfExists('mlm_commissions');
        Schema::dropIfExists('deals');
        Schema::dropIfExists('lead_agents');
        Schema::dropIfExists('leads');
        Schema::dropIfExists('companies');
    }

    private function createMinimalSchema(): void
    {
        Schema::create('companies', function (Blueprint $table) {
            $table->increments('id');
            $table->string('company_name')->nullable();
            $table->timestamps();
        });

        Schema::create('leads', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('client_name');
            $table->unsignedBigInteger('referred_by_agent_id')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });

        Schema::create('deals', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('lead_id')->nullable();
            $table->unsignedInteger('agent_id')->nullable();
            $table->decimal('value', 15, 2)->nullable();
            $table->string('outcome_status')->nullable();
            $table->timestamp('won_at')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });

        Schema::create('lead_agents', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('user_id')->nullable();
            $table->unsignedInteger('parent_agent_id')->nullable();
            $table->timestamps();
        });

        Schema::create('mlm_commissions', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('agent_id')->nullable();
            $table->decimal('amount', 15, 2)->default(0);
            $table->string('status')->nullable();
            $table->string('type')->nullable();
            $table->timestamps();
        });

        DB::table('companies')->insert(['id' => $this->companyId, 'company_name' => 'Test']);
    }
}
