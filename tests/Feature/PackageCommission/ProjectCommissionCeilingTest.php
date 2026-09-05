<?php

namespace Tests\Feature\PackageCommission;

use App\Models\Deal;
use App\Services\MlmCommissionService;
use Illuminate\Support\Facades\Config;
use Tests\PackageCommissionTestCase;

/**
 * The commission ceiling negotiated per developer, overridable per project.
 *
 * Resolution order, most specific first: the per-deal override, then the
 * project (or the developer it belongs to), then the cycle snapshot, then the
 * global setting. Each tier is asserted against the one outside it, because a
 * silently-skipped tier pays a rate nobody agreed to.
 */
class ProjectCommissionCeilingTest extends PackageCommissionTestCase
{
    /** Global fallback is 10%; the agent's own level pays 4% of whatever cap applies. */
    private function seedContext(): array
    {
        Config::set('mlm.max_commission_percentage', 10);

        $companyId = $this->seedCompany();
        $this->seedMlmSettings($companyId, 10);
        $level = $this->seedLevel($companyId, 'Bronze', 1, 4);
        $agentId = $this->seedAgent($companyId, $this->seedUser($companyId, 'Agent'));
        $this->seedLevelHistory($companyId, $agentId, $level);

        return ['company' => $companyId, 'agent' => $agentId];
    }

    /** The system leg takes whatever the agent and uplines leave, so it reveals the cap. */
    private function capFor(int $dealId): float
    {
        $legs = app(MlmCommissionService::class)->preview(
            Deal::withoutGlobalScopes()->findOrFail($dealId)
        );

        return round(array_sum(array_column($legs, 'percentage')), 2);
    }

    public function test_a_developer_rate_applies_to_its_projects(): void
    {
        $ctx = $this->seedContext();
        $developerId = $this->seedDeveloper($ctx['company'], 6);
        $projectId = $this->seedDeveloperProject($ctx['company'], $developerId);

        $dealId = $this->seedDeal($ctx['company'], $ctx['agent'], 100000);
        $this->seedDealProperty($ctx['company'], $dealId, $projectId);

        // 6% from the developer, not the 10% global setting.
        $this->assertSame(6.0, $this->capFor($dealId));
    }

    public function test_a_project_rate_overrides_its_developer(): void
    {
        $ctx = $this->seedContext();
        $developerId = $this->seedDeveloper($ctx['company'], 6);
        $projectId = $this->seedDeveloperProject($ctx['company'], $developerId, 8);

        $dealId = $this->seedDeal($ctx['company'], $ctx['agent'], 100000);
        $this->seedDealProperty($ctx['company'], $dealId, $projectId);

        $this->assertSame(8.0, $this->capFor($dealId));
    }

    public function test_a_deal_override_still_beats_the_project(): void
    {
        $ctx = $this->seedContext();
        $projectId = $this->seedDeveloperProject($ctx['company'], $this->seedDeveloper($ctx['company'], 6), 8);

        $dealId = $this->seedDeal($ctx['company'], $ctx['agent'], 100000);
        $this->seedDealProperty($ctx['company'], $dealId, $projectId);
        Deal::withoutGlobalScopes()->where('id', $dealId)->update(['max_commission_percentage' => 12]);

        $this->assertSame(12.0, $this->capFor($dealId));
    }

    /**
     * An unconfigured developer must defer outward, not cap the deal at zero —
     * the difference between "no rate agreed" and "a rate of nothing".
     */
    public function test_an_unconfigured_project_falls_through_to_the_global_setting(): void
    {
        $ctx = $this->seedContext();
        $projectId = $this->seedDeveloperProject($ctx['company'], $this->seedDeveloper($ctx['company']));

        $dealId = $this->seedDeal($ctx['company'], $ctx['agent'], 100000);
        $this->seedDealProperty($ctx['company'], $dealId, $projectId);

        $this->assertSame(10.0, $this->capFor($dealId));
    }

    public function test_a_property_with_no_project_falls_through(): void
    {
        $ctx = $this->seedContext();
        $dealId = $this->seedDeal($ctx['company'], $ctx['agent'], 100000);
        $this->seedDealProperty($ctx['company'], $dealId, null);

        $this->assertSame(10.0, $this->capFor($dealId));
    }

    /**
     * Ceilings, so the most restrictive one wins: honouring the higher rate
     * would pay a percentage the other counterparty never agreed to.
     */
    public function test_a_deal_spanning_projects_takes_the_lowest_rate(): void
    {
        $ctx = $this->seedContext();
        $developerId = $this->seedDeveloper($ctx['company'], 9);
        $generous = $this->seedDeveloperProject($ctx['company'], $developerId, 9);
        $strict = $this->seedDeveloperProject($ctx['company'], $developerId, 5);

        $dealId = $this->seedDeal($ctx['company'], $ctx['agent'], 100000);
        $this->seedDealProperty($ctx['company'], $dealId, $generous);
        $this->seedDealProperty($ctx['company'], $dealId, $strict);

        $this->assertSame(5.0, $this->capFor($dealId));
    }

    /** A cap below the agent's own level clamps their leg rather than overpaying. */
    public function test_a_cap_below_the_agent_rate_clamps_the_agent_leg(): void
    {
        $ctx = $this->seedContext();
        $projectId = $this->seedDeveloperProject($ctx['company'], $this->seedDeveloper($ctx['company']), 3);

        $dealId = $this->seedDeal($ctx['company'], $ctx['agent'], 100000);
        $this->seedDealProperty($ctx['company'], $dealId, $projectId);

        $legs = app(MlmCommissionService::class)->preview(
            Deal::withoutGlobalScopes()->findOrFail($dealId)
        );

        $agentLeg = collect($legs)->firstWhere('type', 'agent');
        $this->assertSame(3.0, (float) $agentLeg['percentage'], 'Agent leg exceeded the project ceiling');
        $this->assertSame(3000.0, (float) $agentLeg['amount']);
        // Nothing left over, so no system leg at all.
        $this->assertNull(collect($legs)->firstWhere('type', 'system'));
    }
}
