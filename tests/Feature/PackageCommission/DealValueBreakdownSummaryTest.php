<?php

namespace Tests\Feature\PackageCommission;

use App\Models\Deal;
use App\Models\User;
use App\Services\MlmCommissionService;
use Illuminate\Support\Facades\Config;
use Tests\PackageCommissionTestCase;

/**
 * The commission summary behind the deal value-breakdown panel.
 *
 * Two things went wrong here before and both are pinned by these tests:
 * the panel classified a package deal by reading $deal->packages, which
 * DealController::show() eager-loads as `packages:id,name,value` — so
 * commission_type came back null and the deal was silently treated as a
 * property deal; and it subtracted company-currency commission amounts from a
 * deal value still denominated in the deal's own currency.
 */
class DealValueBreakdownSummaryTest extends PackageCommissionTestCase
{
    /** @return array{company: int, agent: int} */
    private function seedAgentOnly(): array
    {
        $companyId = $this->seedCompany();
        $this->seedMlmSettings($companyId, 10);
        $agentId = $this->seedAgent($companyId, $this->seedUser($companyId, 'Agent'));

        return ['company' => $companyId, 'agent' => $agentId];
    }

    private function summaryFor(int $dealId, ?string $eagerLoad = null): array
    {
        $query = Deal::withoutGlobalScopes();

        if ($eagerLoad !== null) {
            $query->with($eagerLoad);
        }

        return app(MlmCommissionService::class)->getCommissionSummary($query->findOrFail($dealId));
    }

    public function test_package_deal_revenue_is_value_minus_commission(): void
    {
        $ctx = $this->seedAgentOnly();
        $packageId = $this->seedPackage($ctx['company'], 1500, 'fixed', 500);
        $dealId = $this->seedDeal($ctx['company'], $ctx['agent'], 1400);
        $this->attachPackage($dealId, $packageId);

        $summary = $this->summaryFor($dealId);

        $this->assertTrue($summary['is_package_deal']);
        $this->assertSame(500.0, $summary['paid_total']);
        $this->assertSame(900.0, $summary['revenue_to_company']);
        // Nothing was ever distributed, so the figures are a live forecast.
        $this->assertTrue($summary['is_projected']);
    }

    /**
     * The regression itself: a deal loaded with a column subset that omits
     * commission_type must still classify as package-priced.
     */
    public function test_package_deal_is_detected_under_a_partial_eager_load(): void
    {
        $ctx = $this->seedAgentOnly();
        $packageId = $this->seedPackage($ctx['company'], 1500, 'fixed', 500);
        $dealId = $this->seedDeal($ctx['company'], $ctx['agent'], 1400);
        $this->attachPackage($dealId, $packageId);

        $summary = $this->summaryFor($dealId, 'packages:id,name,value');

        $this->assertTrue($summary['is_package_deal']);
        $this->assertSame(900.0, $summary['revenue_to_company']);
    }

    /**
     * Commission amounts are company currency; deals.value is not. Revenue has
     * to convert before subtracting, or it is simply the wrong scale.
     */
    public function test_revenue_converts_the_deal_value_to_company_currency(): void
    {
        $ctx = $this->seedAgentOnly();
        // $1 = €0.90, so a $1,000 deal is €900 to the company.
        $usdId = $this->seedCurrency($ctx['company'], 'USD', 0.90);
        $packageId = $this->seedPackage($ctx['company'], 1000, 'fixed', 500);
        $dealId = $this->seedDeal($ctx['company'], $ctx['agent'], 1000, $usdId, 0.90);
        $this->attachPackage($dealId, $packageId);

        $summary = $this->summaryFor($dealId);

        // €900 - €500, not $1,000 - €500.
        $this->assertSame(400.0, $summary['revenue_to_company']);
    }

    /**
     * On a property deal the System leg is the slice no one in the agent
     * hierarchy claimed — the company keeps it. Reporting it as "commission
     * paid" overstated the deal's cost by exactly the company's own margin.
     */
    public function test_the_system_leg_is_company_revenue_not_commission_paid(): void
    {
        Config::set('mlm.max_commission_percentage', 10);

        $companyId = $this->seedCompany();
        $this->seedMlmSettings($companyId, 10);
        $level = $this->seedLevel($companyId, 'Bronze', 1, 4);
        $agentId = $this->seedAgent($companyId, $this->seedUser($companyId, 'Agent'));
        $this->seedLevelHistory($companyId, $agentId, $level);

        // No packages: the level-based split, so agent 4% + system 6%.
        $dealId = $this->seedDeal($companyId, $agentId, 100000);

        $summary = $this->summaryFor($dealId);

        $this->assertFalse($summary['is_package_deal']);
        // 4% of 100,000 — the agent's leg alone, not the 10% total.
        $this->assertSame(4000.0, $summary['paid_total']);
        // 6% of 100,000 — the unclaimed remainder the company keeps.
        $this->assertSame(6000.0, $summary['revenue_to_company']);
    }

    public function test_upline_commission_is_paid_when_the_hierarchy_is_populated(): void
    {
        Config::set('mlm.max_commission_percentage', 10);

        $companyId = $this->seedCompany();
        $this->seedMlmSettings($companyId, 10);
        $bronze = $this->seedLevel($companyId, 'Bronze', 1, 4);
        $silver = $this->seedLevel($companyId, 'Silver', 2, 7);

        $uplineId = $this->seedAgent($companyId, $this->seedUser($companyId, 'Upline'));
        $this->seedLevelHistory($companyId, $uplineId, $silver);

        $agentId = $this->seedAgent($companyId, $this->seedUser($companyId, 'Agent'), $uplineId);
        $this->seedLevelHistory($companyId, $agentId, $bronze);

        // The closure table — not parent_agent_id — is what the engine reads.
        $this->seedHierarchyLink($uplineId, $agentId, 1);

        $summary = $this->summaryFor($this->seedDeal($companyId, $agentId, 100000));

        // Agent 4% + upline's 3% differential (7% - 4%) = 7,000 paid out,
        // leaving the remaining 3% of the 10% cap as company revenue.
        $this->assertSame(7000.0, $summary['paid_total']);
        $this->assertSame(3000.0, $summary['revenue_to_company']);
    }

    /**
     * Level-based legs are each a percentage of the same deal value, so the
     * rate behind the paid figure is their sum.
     */
    public function test_level_based_legs_report_their_combined_percentage(): void
    {
        Config::set('mlm.max_commission_percentage', 10);

        $companyId = $this->seedCompany();
        $this->seedMlmSettings($companyId, 10);
        $bronze = $this->seedLevel($companyId, 'Bronze', 1, 4);
        $silver = $this->seedLevel($companyId, 'Silver', 2, 7);

        $uplineId = $this->seedAgent($companyId, $this->seedUser($companyId, 'Upline'));
        $this->seedLevelHistory($companyId, $uplineId, $silver);
        $agentId = $this->seedAgent($companyId, $this->seedUser($companyId, 'Agent'), $uplineId);
        $this->seedLevelHistory($companyId, $agentId, $bronze);
        $this->seedHierarchyLink($uplineId, $agentId, 1);

        $summary = $this->summaryFor($this->seedDeal($companyId, $agentId, 100000));

        // 4% agent + 3% upline differential.
        $this->assertSame(7.0, $summary['paid_percentage']);
        $this->assertSame(7000.0, $summary['paid_total']);
    }

    public function test_a_fixed_package_fee_reports_no_percentage(): void
    {
        $ctx = $this->seedAgentOnly();
        $packageId = $this->seedPackage($ctx['company'], 1500, 'fixed', 500);
        $dealId = $this->seedDeal($ctx['company'], $ctx['agent'], 1400);
        $this->attachPackage($dealId, $packageId);

        $this->assertNull($this->summaryFor($dealId)['paid_percentage']);
        $this->assertSame(500.0, $this->summaryFor($dealId)['paid_total']);
    }

    public function test_a_single_percentage_package_reports_its_rate(): void
    {
        $ctx = $this->seedAgentOnly();
        $packageId = $this->seedPackage($ctx['company'], 2000, 'percentage', 10);
        $dealId = $this->seedDeal($ctx['company'], $ctx['agent'], 2000);
        $this->attachPackage($dealId, $packageId);

        $summary = $this->summaryFor($dealId);

        $this->assertSame(10.0, $summary['paid_percentage']);
        $this->assertSame(200.0, $summary['paid_total']);
    }

    /**
     * Each package percentage is taken off its own package's value, so two of
     * them describe different bases and cannot be added into one rate.
     */
    public function test_two_percentage_packages_report_no_single_rate(): void
    {
        $ctx = $this->seedAgentOnly();
        $dealId = $this->seedDeal($ctx['company'], $ctx['agent'], 3000);
        $this->attachPackage($dealId, $this->seedPackage($ctx['company'], 2000, 'percentage', 10));
        $this->attachPackage($dealId, $this->seedPackage($ctx['company'], 1000, 'percentage', 5));

        $summary = $this->summaryFor($dealId);

        $this->assertNull($summary['paid_percentage']);
        // 10% of 2,000 + 5% of 1,000 — the amounts still add up fine.
        $this->assertSame(250.0, $summary['paid_total']);
    }

    /**
     * An agent and each upline see their own earnings without seeing the
     * deal-wide total. Entitlement to the "your commission" figure is derived
     * from having a leg, not from a permission — which is what lets an upline
     * qualify without any extra hierarchy check at the gate.
     */
    public function test_each_earner_sees_only_their_own_share(): void
    {
        Config::set('mlm.max_commission_percentage', 10);

        $companyId = $this->seedCompany();
        $this->seedMlmSettings($companyId, 10);
        $bronze = $this->seedLevel($companyId, 'Bronze', 1, 4);
        $silver = $this->seedLevel($companyId, 'Silver', 2, 7);

        $uplineUser = $this->seedUser($companyId, 'Upline');
        $uplineId = $this->seedAgent($companyId, $uplineUser);
        $this->seedLevelHistory($companyId, $uplineId, $silver);

        $agentUser = $this->seedUser($companyId, 'Agent');
        $agentId = $this->seedAgent($companyId, $agentUser, $uplineId);
        $this->seedLevelHistory($companyId, $agentId, $bronze);
        $this->seedHierarchyLink($uplineId, $agentId, 1);

        $strangerUser = $this->seedUser($companyId, 'Stranger');

        $deal = Deal::withoutGlobalScopes()->findOrFail(
            $this->seedDeal($companyId, $agentId, 100000)
        );
        $service = app(MlmCommissionService::class);

        $viewer = fn (int $userId) => User::withoutGlobalScopes()->findOrFail($userId);

        // Agent: their own 4%, of a 7% deal-wide payout.
        $asAgent = $service->getCommissionSummary($deal, $viewer($agentUser));
        $this->assertSame(4000.0, $asAgent['own_total']);
        $this->assertSame(4.0, $asAgent['own_percentage']);
        $this->assertSame(7000.0, $asAgent['paid_total']);

        // Upline: only their 3% differential.
        $asUpline = $service->getCommissionSummary($deal, $viewer($uplineUser));
        $this->assertSame(3000.0, $asUpline['own_total']);
        $this->assertSame(3.0, $asUpline['own_percentage']);

        // Someone who earned nothing on this deal has no own share at all.
        $this->assertNull($service->getCommissionSummary($deal, $viewer($strangerUser))['own_total']);

        // And with no viewer there is no own share to report.
        $this->assertNull($service->getCommissionSummary($deal)['own_total']);
    }

    /**
     * The privileged panel lists each leg above the total, so the rows have to
     * sum to it — the system leg belongs on the revenue line, not among the
     * people who were paid.
     */
    public function test_the_listed_legs_sum_to_the_paid_total_and_exclude_system(): void
    {
        Config::set('mlm.max_commission_percentage', 10);

        $companyId = $this->seedCompany();
        $this->seedMlmSettings($companyId, 10);
        $bronze = $this->seedLevel($companyId, 'Bronze', 1, 4);
        $silver = $this->seedLevel($companyId, 'Silver', 2, 7);

        $uplineId = $this->seedAgent($companyId, $this->seedUser($companyId, 'Upline'));
        $this->seedLevelHistory($companyId, $uplineId, $silver);
        $agentId = $this->seedAgent($companyId, $this->seedUser($companyId, 'Agent'), $uplineId);
        $this->seedLevelHistory($companyId, $agentId, $bronze);
        $this->seedHierarchyLink($uplineId, $agentId, 1);

        $summary = $this->summaryFor($this->seedDeal($companyId, $agentId, 100000));

        $this->assertCount(2, $summary['legs'], 'System leg leaked into the listed legs');
        $this->assertSame(
            $summary['paid_total'],
            round(array_sum(array_column($summary['legs'], 'amount')), 2),
            'Listed legs do not add up to the total shown beneath them',
        );

        // Engine order: the selling agent first, then uplines outward.
        $this->assertSame('agent', $summary['legs'][0]['type']);
        $this->assertSame($agentId, $summary['legs'][0]['agent_id']);
        $this->assertSame('upline', $summary['legs'][1]['type']);
        $this->assertSame($uplineId, $summary['legs'][1]['agent_id']);

        // Nothing in the list is the company's own share.
        foreach ($summary['legs'] as $leg) {
            $this->assertNotSame('system', $leg['type']);
        }
    }

    /** The system leg is the company's, so it never counts as anyone's own. */
    public function test_the_system_leg_is_never_reported_as_an_agents_own_share(): void
    {
        Config::set('mlm.max_commission_percentage', 10);

        $companyId = $this->seedCompany();
        $this->seedMlmSettings($companyId, 10);
        $level = $this->seedLevel($companyId, 'Bronze', 1, 4);
        $agentUser = $this->seedUser($companyId, 'Agent');
        $agentId = $this->seedAgent($companyId, $agentUser);
        $this->seedLevelHistory($companyId, $agentId, $level);

        $deal = Deal::withoutGlobalScopes()->findOrFail(
            $this->seedDeal($companyId, $agentId, 100000)
        );

        // The system leg is written against the same agent_id, so a naive
        // "legs where agent_id = mine" would hand them the company's 6% too.
        $summary = app(MlmCommissionService::class)
            ->getCommissionSummary($deal, User::withoutGlobalScopes()->findOrFail($agentUser));

        $this->assertSame(4000.0, $summary['own_total']);
        $this->assertSame(6000.0, $summary['revenue_to_company']);
    }

    public function test_a_deal_with_no_commission_package_is_not_a_package_deal(): void
    {
        $ctx = $this->seedAgentOnly();
        // A package with no commission_type configured pays via the level-based
        // split instead, so the deal is not package-priced.
        $packageId = $this->seedPackage($ctx['company'], 1500);
        $dealId = $this->seedDeal($ctx['company'], $ctx['agent'], 1400);
        $this->attachPackage($dealId, $packageId);

        $this->assertFalse($this->summaryFor($dealId)['is_package_deal']);
    }
}
