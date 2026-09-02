<?php

namespace Tests\Feature\PackageCommission;

use App\Enums\MlmCommissionType;
use App\Models\Deal;
use App\Models\MlmCommission;
use App\Services\MlmCommissionService;
use Illuminate\Support\Facades\Config;
use Tests\PackageCommissionTestCase;

class CommissionCalculationTest extends PackageCommissionTestCase
{
    /**
     * A deal with a level-eligible agent AND an upline, so that any accidental
     * fall-through to the level distribution shows up as extra legs.
     *
     * @return array{company: int, agent: int, upline: int, deal: int}
     */
    private function seedDealWithUpline(float $dealValue = 1000): array
    {
        Config::set('mlm.max_commission_percentage', 10);

        $companyId = $this->seedCompany();
        $this->seedMlmSettings($companyId, 10);

        $bronze = $this->seedLevel($companyId, 'Bronze', 1, 3);
        $gold = $this->seedLevel($companyId, 'Gold', 2, 6);

        $uplineId = $this->seedAgent($companyId, $this->seedUser($companyId, 'Upline'));
        $this->seedLevelHistory($companyId, $uplineId, $gold);

        $agentId = $this->seedAgent($companyId, $this->seedUser($companyId, 'Agent'), $uplineId);
        $this->seedLevelHistory($companyId, $agentId, $bronze);
        $this->seedHierarchyLink($uplineId, $agentId, 1);

        return [
            'company' => $companyId,
            'agent' => $agentId,
            'upline' => $uplineId,
            'deal' => $this->seedDeal($companyId, $agentId, $dealValue),
        ];
    }

    private function distribute(int $dealId): void
    {
        app(MlmCommissionService::class)->distribute(
            Deal::withoutGlobalScopes()->findOrFail($dealId)
        );
    }

    public function test_percentage_package_pays_pct_of_package_value_only(): void
    {
        $ctx = $this->seedDealWithUpline(1000);
        // Package value differs from deal value: the percentage must be taken
        // from the package, not the deal.
        $packageId = $this->seedPackage($ctx['company'], 8000, 'percentage', 5);
        $this->attachPackage($ctx['deal'], $packageId);

        $this->distribute($ctx['deal']);

        $legs = MlmCommission::where('deal_id', $ctx['deal'])->get();

        $this->assertCount(1, $legs, 'A package deal writes the agent leg and nothing else.');

        $leg = $legs->first();
        $this->assertSame(MlmCommissionType::Agent, $leg->type);
        $this->assertSame($ctx['agent'], (int) $leg->agent_id);
        $this->assertSame(400.0, (float) $leg->amount, '5% of the 8000 package, not the 1000 deal.');
        $this->assertSame(5.0, (float) $leg->percentage);
        $this->assertSame($packageId, (int) $leg->package_id);
        $this->assertNull($leg->level_id, 'A package leg is not earned via a level.');
    }

    public function test_fixed_package_pays_a_flat_fee_with_no_percentage(): void
    {
        $ctx = $this->seedDealWithUpline(1000);
        $packageId = $this->seedPackage($ctx['company'], 8000, 'fixed', 250);
        $this->attachPackage($ctx['deal'], $packageId);

        $this->distribute($ctx['deal']);

        $legs = MlmCommission::where('deal_id', $ctx['deal'])->get();

        $this->assertCount(1, $legs);
        $this->assertSame(250.0, (float) $legs->first()->amount);
        $this->assertNull(
            $legs->first()->percentage,
            'A flat fee has no percentage; storing a derived one would be a number that lies.'
        );
    }

    public function test_per_agent_override_beats_the_package_default(): void
    {
        $ctx = $this->seedDealWithUpline(1000);
        $packageId = $this->seedPackage($ctx['company'], 8000, 'percentage', 5);
        $this->attachPackage($ctx['deal'], $packageId);
        $this->seedAgentPackageRate($ctx['company'], $ctx['agent'], $packageId, 'fixed', 900);

        $this->distribute($ctx['deal']);

        $leg = MlmCommission::where('deal_id', $ctx['deal'])->firstOrFail();

        $this->assertSame(900.0, (float) $leg->amount);
        $this->assertNull($leg->percentage, 'The override switched the shape to fixed.');
    }

    public function test_override_belonging_to_another_agent_is_ignored(): void
    {
        $ctx = $this->seedDealWithUpline(1000);
        $packageId = $this->seedPackage($ctx['company'], 8000, 'percentage', 5);
        $this->attachPackage($ctx['deal'], $packageId);
        // The upline's override must not leak onto the closing agent's leg.
        $this->seedAgentPackageRate($ctx['company'], $ctx['upline'], $packageId, 'fixed', 900);

        $this->distribute($ctx['deal']);

        $this->assertSame(400.0, (float) MlmCommission::where('deal_id', $ctx['deal'])->firstOrFail()->amount);
    }

    public function test_unconfigured_package_falls_through_to_the_level_distribution(): void
    {
        $ctx = $this->seedDealWithUpline(1000);
        $packageId = $this->seedPackage($ctx['company'], 8000, null, null);
        $this->attachPackage($ctx['deal'], $packageId);

        $this->distribute($ctx['deal']);

        $legs = MlmCommission::where('deal_id', $ctx['deal'])->get();

        // Bronze 3% agent + Gold differential 3% upline + 4% system = the
        // untouched pre-existing behaviour.
        $this->assertCount(3, $legs);
        $this->assertSame(30.0, (float) $legs->firstWhere('type', MlmCommissionType::Agent)->amount);
        $this->assertSame(30.0, (float) $legs->firstWhere('type', MlmCommissionType::Upline)->amount);
        $this->assertSame(40.0, (float) $legs->firstWhere('type', MlmCommissionType::System)->amount);
        $this->assertTrue($legs->every(fn ($leg) => $leg->package_id === null));
    }

    public function test_deal_with_no_packages_is_untouched(): void
    {
        $ctx = $this->seedDealWithUpline(1000);

        $this->distribute($ctx['deal']);

        $this->assertCount(3, MlmCommission::where('deal_id', $ctx['deal'])->get());
    }

    public function test_package_configured_at_zero_pays_nothing_and_does_not_fall_back(): void
    {
        $ctx = $this->seedDealWithUpline(1000);
        $packageId = $this->seedPackage($ctx['company'], 8000, 'percentage', 0);
        $this->attachPackage($ctx['deal'], $packageId);

        $this->distribute($ctx['deal']);

        $this->assertCount(
            0,
            MlmCommission::where('deal_id', $ctx['deal'])->get(),
            'Configured-at-zero must mean zero, never a silent fall-back to the full level split.'
        );
    }

    public function test_zero_value_package_on_a_percentage_rate_writes_no_leg(): void
    {
        $ctx = $this->seedDealWithUpline(1000);
        $packageId = $this->seedPackage($ctx['company'], 0, 'percentage', 5);
        $this->attachPackage($ctx['deal'], $packageId);

        $this->distribute($ctx['deal']);

        $this->assertCount(0, MlmCommission::where('deal_id', $ctx['deal'])->get());
    }

    public function test_multiple_configured_packages_sum_their_legs(): void
    {
        $ctx = $this->seedDealWithUpline(1000);
        $gold = $this->seedPackage($ctx['company'], 8000, 'percentage', 5, 'EUR', 'Gold');
        $addon = $this->seedPackage($ctx['company'], 2000, 'fixed', 150, 'EUR', 'Addon');
        $this->attachPackage($ctx['deal'], $gold);
        $this->attachPackage($ctx['deal'], $addon);

        $this->distribute($ctx['deal']);

        $legs = MlmCommission::where('deal_id', $ctx['deal'])->get();

        $this->assertCount(2, $legs);
        $this->assertSame(550.0, (float) $legs->sum('amount'));
    }

    public function test_one_configured_package_puts_the_whole_deal_in_package_mode(): void
    {
        $ctx = $this->seedDealWithUpline(1000);
        $configured = $this->seedPackage($ctx['company'], 8000, 'percentage', 5, 'EUR', 'Gold');
        $unconfigured = $this->seedPackage($ctx['company'], 2000, null, null, 'EUR', 'Plain');
        $this->attachPackage($ctx['deal'], $configured);
        $this->attachPackage($ctx['deal'], $unconfigured);

        $this->distribute($ctx['deal']);

        $legs = MlmCommission::where('deal_id', $ctx['deal'])->get();

        $this->assertCount(1, $legs, 'No level-based fallback for the unconfigured package.');
        $this->assertSame(400.0, (float) $legs->first()->amount);
    }

    /**
     * "None" is a distinct configured state from "unconfigured" (null): both
     * pay zero on their own, but only null falls through to the level-based
     * split. None must not fall through either.
     */
    public function test_none_package_pays_nothing_and_does_not_fall_back(): void
    {
        $ctx = $this->seedDealWithUpline(1000);
        $packageId = $this->seedPackage($ctx['company'], 8000, 'none', null);
        $this->attachPackage($ctx['deal'], $packageId);

        $this->distribute($ctx['deal']);

        $this->assertCount(
            0,
            MlmCommission::where('deal_id', $ctx['deal'])->get(),
            'A None package must behave like a configured zero, not an unconfigured fall-through.'
        );
    }

    public function test_none_package_ignores_a_stray_stored_value(): void
    {
        // Defensive: resolvePackageCommission must not trust commission_value
        // just because it happens to be present on a None row.
        $ctx = $this->seedDealWithUpline(1000);
        $packageId = $this->seedPackage($ctx['company'], 8000, 'none', 500);
        $this->attachPackage($ctx['deal'], $packageId);

        $this->distribute($ctx['deal']);

        $this->assertCount(0, MlmCommission::where('deal_id', $ctx['deal'])->get());
    }

    public function test_agent_override_can_grant_a_fee_on_a_none_package(): void
    {
        $ctx = $this->seedDealWithUpline(1000);
        $packageId = $this->seedPackage($ctx['company'], 8000, 'none', null);
        $this->attachPackage($ctx['deal'], $packageId);
        $this->seedAgentPackageRate($ctx['company'], $ctx['agent'], $packageId, 'fixed', 300);

        $this->distribute($ctx['deal']);

        $leg = MlmCommission::where('deal_id', $ctx['deal'])->firstOrFail();
        $this->assertSame(300.0, (float) $leg->amount);
    }

    public function test_agent_override_can_zero_out_a_paying_package(): void
    {
        $ctx = $this->seedDealWithUpline(1000);
        $packageId = $this->seedPackage($ctx['company'], 8000, 'percentage', 5);
        $this->attachPackage($ctx['deal'], $packageId);
        $this->seedAgentPackageRate($ctx['company'], $ctx['agent'], $packageId, 'none', null);

        $this->distribute($ctx['deal']);

        $this->assertCount(
            0,
            MlmCommission::where('deal_id', $ctx['deal'])->get(),
            'A None override must silence the package default entirely.'
        );
    }
}
