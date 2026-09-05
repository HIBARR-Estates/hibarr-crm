<?php

namespace Tests\Feature\PackageCommission;

use App\Enums\MlmCommissionType;
use App\Models\Deal;
use App\Models\MlmCommission;
use App\Services\MlmCommissionService;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Tests\PackageCommissionTestCase;

/**
 * Package commissions must count toward an agent's totals like any other.
 *
 * That holds only because a package leg is written with type = Agent against
 * the closing agent, and because no commission aggregate filters on level_id
 * (a package leg's level_id is null, and `level_id != x` is NULL-unsafe in SQL,
 * so such a filter would silently drop every package leg). Neither property is
 * visible from reading the aggregation code, so both are pinned here.
 */
class PackageCommissionTotalsTest extends PackageCommissionTestCase
{
    /** @return array{company: int, agent: int, deal: int} */
    private function seedAgentWithLevel(float $dealValue = 1000): array
    {
        Config::set('mlm.max_commission_percentage', 10);

        $companyId = $this->seedCompany();
        $this->seedMlmSettings($companyId, 10);

        $bronze = $this->seedLevel($companyId, 'Bronze', 1, 3);
        $agentId = $this->seedAgent($companyId, $this->seedUser($companyId, 'Agent'));
        $this->seedLevelHistory($companyId, $agentId, $bronze);

        return [
            'company' => $companyId,
            'agent' => $agentId,
            'deal' => $this->seedDeal($companyId, $agentId, $dealValue),
        ];
    }

    private function distribute(int $dealId): void
    {
        app(MlmCommissionService::class)->distribute(
            Deal::withoutGlobalScopes()->findOrFail($dealId)
        );
    }

    /** The exact filter every agent-facing total uses (MlmAgentController). */
    private function agentEarnings(int $agentId): float
    {
        return (float) MlmCommission::where('agent_id', $agentId)
            ->where('type', '!=', MlmCommissionType::System->value)
            ->sum('amount');
    }

    public function test_fixed_fee_package_leg_counts_toward_agent_earnings(): void
    {
        $ctx = $this->seedAgentWithLevel();
        $packageId = $this->seedPackage($ctx['company'], 8000, 'fixed', 250);
        $this->attachPackage($ctx['deal'], $packageId);

        $this->distribute($ctx['deal']);

        $this->assertSame(250.0, $this->agentEarnings($ctx['agent']));
        $this->assertSame(
            1,
            MlmCommission::where('agent_id', $ctx['agent'])
                ->where('type', '!=', MlmCommissionType::System->value)
                ->count(),
            'The leg must be visible to the record count on My Commissions.'
        );
    }

    public function test_package_leg_survives_the_top_agents_aggregate(): void
    {
        $ctx = $this->seedAgentWithLevel();
        $packageId = $this->seedPackage($ctx['company'], 8000, 'percentage', 5);
        $this->attachPackage($ctx['deal'], $packageId);

        $this->distribute($ctx['deal']);

        // Mirrors MlmAdminApiController::dashboardStats() top-10 agents.
        $row = MlmCommission::where('mlm_commissions.company_id', $ctx['company'])
            ->where('mlm_commissions.type', '!=', MlmCommissionType::System->value)
            ->select('agent_id', DB::raw('SUM(amount) as total_earned'))
            ->groupBy('agent_id')
            ->first();

        $this->assertNotNull($row, 'A package leg must not vanish from the leaderboard.');
        $this->assertSame(400.0, (float) $row->total_earned);
    }

    public function test_package_and_level_legs_both_count_without_double_counting(): void
    {
        $ctx = $this->seedAgentWithLevel();

        // An earlier, level-based deal.
        $legacyDeal = $this->seedDeal($ctx['company'], $ctx['agent'], 1000);
        $this->distribute($legacyDeal);

        // A later package deal.
        $packageId = $this->seedPackage($ctx['company'], 8000, 'fixed', 250);
        $this->attachPackage($ctx['deal'], $packageId);
        $this->distribute($ctx['deal']);

        // 3% of 1000 from the level deal + the 250 flat package fee.
        $this->assertSame(280.0, $this->agentEarnings($ctx['agent']));
    }

    public function test_a_null_level_id_does_not_hide_the_leg_from_totals(): void
    {
        $ctx = $this->seedAgentWithLevel();
        $packageId = $this->seedPackage($ctx['company'], 8000, 'fixed', 250);
        $this->attachPackage($ctx['deal'], $packageId);

        $this->distribute($ctx['deal']);

        $leg = MlmCommission::where('deal_id', $ctx['deal'])->firstOrFail();

        $this->assertNull($leg->level_id);
        $this->assertGreaterThan(
            0,
            MlmCommission::whereNull('level_id')->where('agent_id', $ctx['agent'])->count()
        );
    }
}
