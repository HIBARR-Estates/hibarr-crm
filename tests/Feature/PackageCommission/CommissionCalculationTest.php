<?php

namespace Tests\Feature\PackageCommission;

use App\Enums\MlmCommissionType;
use App\Models\Deal;
use App\Models\MlmCommission;
use App\Services\MlmCommissionService;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Tests\Concerns\SetsFeatureFlags;
use Tests\PackageCommissionTestCase;

class CommissionCalculationTest extends PackageCommissionTestCase
{
    use SetsFeatureFlags;

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

    // ── Referral commission ────────────────────────────────────────────────
    //
    // The fixture: a 1000 deal, closer 3%, upline differential 3%, 10% ceiling,
    // so 100 of commission is possible and the company keeps 40 of it.

    /** @return Collection<int, array<string, mixed>> */
    private function previewLegs(int $dealId): Collection
    {
        return collect(app(MlmCommissionService::class)->preview(
            Deal::withoutGlobalScopes()->findOrFail($dealId)
        ));
    }

    private function referral(Collection $legs): ?array
    {
        return $legs->firstWhere('type', MlmCommissionType::Referral->value);
    }

    public function test_property_deal_pays_the_partners_percentage_of_the_deal_value(): void
    {
        $ctx = $this->seedDealWithUpline(1000);
        $referrerId = $this->seedAgent($ctx['company'], $this->seedUser($ctx['company'], 'Partner'));
        $this->refer($ctx, $referrerId, 'percentage', 2);

        $legs = $this->previewLegs($ctx['deal']);

        $this->assertSame(20.0, (float) $this->referral($legs)['amount'], '2% of the 1000 deal, not of the pool.');
        $this->assertSame($referrerId, (int) $this->referral($legs)['agent_id']);
        $this->assertNull($this->referral($legs)['package_id']);
        $this->assertSame(20.0, (float) $legs->firstWhere('type', MlmCommissionType::System->value)['amount']);
    }

    public function test_property_deal_pays_the_partners_fixed_amount(): void
    {
        $ctx = $this->seedDealWithUpline(1000);
        $referrerId = $this->seedAgent($ctx['company'], $this->seedUser($ctx['company'], 'Partner'));
        $this->refer($ctx, $referrerId, 'fixed', 15);

        $this->assertSame(15.0, (float) $this->referral($this->previewLegs($ctx['deal']))['amount']);
    }

    public function test_property_referral_is_capped_at_what_the_company_still_holds(): void
    {
        $ctx = $this->seedDealWithUpline(1000);
        $referrerId = $this->seedAgent($ctx['company'], $this->seedUser($ctx['company'], 'Partner'));
        $this->refer($ctx, $referrerId, 'percentage', 10);

        $legs = $this->previewLegs($ctx['deal']);

        $this->assertSame(40.0, (float) $this->referral($legs)['amount'], '10% of 1000 is 100, but only 40 is left.');
        $this->assertNull($legs->firstWhere('type', MlmCommissionType::System->value));
    }

    public function test_a_partner_with_no_terms_earns_nothing(): void
    {
        $ctx = $this->seedDealWithUpline(1000);
        $referrerId = $this->seedAgent($ctx['company'], $this->seedUser($ctx['company'], 'Partner'));
        $this->refer($ctx, $referrerId);

        $legs = $this->previewLegs($ctx['deal']);

        $this->assertNull($this->referral($legs));
        $this->assertSame(40.0, (float) $legs->firstWhere('type', MlmCommissionType::System->value)['amount']);
    }

    public function test_the_deals_own_override_beats_the_partners_terms(): void
    {
        $ctx = $this->seedDealWithUpline(1000);
        $referrerId = $this->seedAgent($ctx['company'], $this->seedUser($ctx['company'], 'Partner'));
        $this->refer($ctx, $referrerId, 'percentage', 2, 'fixed', 10);

        $this->assertSame(10.0, (float) $this->referral($this->previewLegs($ctx['deal']))['amount']);
    }

    public function test_a_deal_marked_not_paid_pays_the_referrer_nothing(): void
    {
        $ctx = $this->seedDealWithUpline(1000);
        $referrerId = $this->seedAgent($ctx['company'], $this->seedUser($ctx['company'], 'Partner'));
        $this->refer($ctx, $referrerId, 'percentage', 2, 'none');

        $legs = $this->previewLegs($ctx['deal']);

        $this->assertNull($this->referral($legs));
        $this->assertSame(40.0, (float) $legs->firstWhere('type', MlmCommissionType::System->value)['amount']);
    }

    public function test_a_deal_percentage_override_is_taken_from_the_deal_value(): void
    {
        $ctx = $this->seedDealWithUpline(1000);
        $referrerId = $this->seedAgent($ctx['company'], $this->seedUser($ctx['company'], 'Partner'));
        $this->refer($ctx, $referrerId, 'fixed', 5, 'percentage', 3);

        $this->assertSame(30.0, (float) $this->referral($this->previewLegs($ctx['deal']))['amount']);
    }

    public function test_package_deal_pays_the_referrers_terms_on_that_package(): void
    {
        $ctx = $this->seedDealWithUpline(1000);
        $packageId = $this->seedPackage($ctx['company'], 8000, 'percentage', 5);
        $this->attachPackage($ctx['deal'], $packageId);
        $referrerId = $this->seedAgent($ctx['company'], $this->seedUser($ctx['company'], 'Partner'));
        $this->seedAgentPackageRate($ctx['company'], $referrerId, $packageId, null, null, 'percentage', 1);
        $this->refer($ctx, $referrerId);

        $legs = $this->previewLegs($ctx['deal']);

        $referral = $this->referral($legs);
        $this->assertSame(80.0, (float) $referral['amount'], '1% of the 8000 package.');
        $this->assertSame($packageId, (int) $referral['package_id']);
        $this->assertSame(
            400.0,
            (float) $legs->firstWhere('type', MlmCommissionType::Agent->value)['amount'],
            'The closer\'s package fee is not reduced.'
        );
    }

    public function test_package_deal_pays_a_fixed_referral_amount_on_that_package(): void
    {
        $ctx = $this->seedDealWithUpline(1000);
        $packageId = $this->seedPackage($ctx['company'], 8000, 'percentage', 5);
        $this->attachPackage($ctx['deal'], $packageId);
        $referrerId = $this->seedAgent($ctx['company'], $this->seedUser($ctx['company'], 'Partner'));
        $this->seedAgentPackageRate($ctx['company'], $referrerId, $packageId, null, null, 'fixed', 60);
        $this->refer($ctx, $referrerId);

        $this->assertSame(60.0, (float) $this->referral($this->previewLegs($ctx['deal']))['amount']);
    }

    public function test_a_fixed_referral_fee_carries_no_percentage(): void
    {
        $ctx = $this->seedDealWithUpline(1000);
        $packageId = $this->seedPackage($ctx['company'], 8000, 'percentage', 5);
        $this->attachPackage($ctx['deal'], $packageId);
        $referrerId = $this->seedAgent($ctx['company'], $this->seedUser($ctx['company'], 'Partner'));
        $this->seedAgentPackageRate($ctx['company'], $referrerId, $packageId, null, null, 'fixed', 60);
        $this->refer($ctx, $referrerId);

        $leg = $this->referral($this->previewLegs($ctx['deal']));

        $this->assertSame(60.0, (float) $leg['amount']);
        $this->assertNull($leg['percentage'], 'A flat fee is not N% of the deal.');

        $summary = app(MlmCommissionService::class)->getCommissionSummary(Deal::withoutGlobalScopes()->findOrFail($ctx['deal']));
        $this->assertNull($summary['paid_percentage']);
    }

    public function test_a_percentage_referral_keeps_its_percentage_of_the_deal(): void
    {
        $ctx = $this->seedDealWithUpline(1000);
        $referrerId = $this->seedAgent($ctx['company'], $this->seedUser($ctx['company'], 'Partner'));
        $this->refer($ctx, $referrerId, 'percentage', 2);

        $this->assertSame(2.0, (float) $this->referral($this->previewLegs($ctx['deal']))['percentage']);
    }

    public function test_a_package_referral_percentage_is_of_the_package_value_not_the_deal(): void
    {
        $ctx = $this->seedDealWithUpline(1000);
        // The package is worth far more than the deal it was sold on.
        // The closer earns nothing on it, so the referral is the only paid leg.
        $packageId = $this->seedPackage($ctx['company'], 8000, 'none');
        $this->attachPackage($ctx['deal'], $packageId);
        $referrerId = $this->seedAgent($ctx['company'], $this->seedUser($ctx['company'], 'Partner'));
        $this->seedAgentPackageRate($ctx['company'], $referrerId, $packageId, null, null, 'percentage', 1);
        $this->refer($ctx, $referrerId);

        $leg = $this->referral($this->previewLegs($ctx['deal']));

        $this->assertSame(80.0, (float) $leg['amount'], '1% of the 8,000 package.');
        $this->assertSame(1.0, (float) $leg['percentage'], 'Not 8%, which is the amount over the 1,000 deal.');

        $summary = app(MlmCommissionService::class)->getCommissionSummary(Deal::withoutGlobalScopes()->findOrFail($ctx['deal']));
        $this->assertSame(1.0, $summary['paid_percentage']);
    }

    public function test_the_summary_does_not_add_a_package_percentage_to_level_percentages(): void
    {
        $ctx = $this->seedDealWithUpline(1000);
        // No closer commission on the package, so the deal stays on level commissions
        // (3% closer + 3% upline), but the referral is still 0.5% of the 8,000 package.
        $packageId = $this->seedPackage($ctx['company'], 8000);
        $this->attachPackage($ctx['deal'], $packageId);
        $referrerId = $this->seedAgent($ctx['company'], $this->seedUser($ctx['company'], 'Partner'));
        $this->seedAgentPackageRate($ctx['company'], $referrerId, $packageId, null, null, 'percentage', 0.5);
        $this->refer($ctx, $referrerId);

        $summary = app(MlmCommissionService::class)->getCommissionSummary(Deal::withoutGlobalScopes()->findOrFail($ctx['deal']));

        $this->assertSame(40.0, (float) $this->referral(collect($summary['legs']))['amount']);
        $this->assertSame(100.0, $summary['paid_total']);
        $this->assertNull($summary['paid_percentage'], '6% of the deal plus 0.5% of the package is not 6.5% of anything.');
    }

    public function test_level_percentages_still_sum_when_nothing_is_tied_to_a_package(): void
    {
        $ctx = $this->seedDealWithUpline(1000);
        $referrerId = $this->seedAgent($ctx['company'], $this->seedUser($ctx['company'], 'Partner'));
        $this->refer($ctx, $referrerId, 'percentage', 2);

        $summary = app(MlmCommissionService::class)->getCommissionSummary(Deal::withoutGlobalScopes()->findOrFail($ctx['deal']));

        $this->assertSame(8.0, $summary['paid_percentage'], '3% + 3% + the 2% referral, all of the deal value.');
    }

    public function test_a_commission_locked_deal_with_no_ledger_rows_is_settled_not_projected(): void
    {
        $ctx = $this->seedDealWithUpline(1000);
        $referrerId = $this->seedAgent($ctx['company'], $this->seedUser($ctx['company'], 'Partner'));
        $this->refer($ctx, $referrerId);
        // Finalized when no one was owed anything; terms are set afterwards.
        DB::table('deals')->where('id', $ctx['deal'])->update(['commission_locked' => true]);
        DB::table('lead_agents')->where('id', $referrerId)->update(['referral_commission_type' => 'percentage', 'referral_commission_value' => 2]);

        $summary = app(MlmCommissionService::class)->getCommissionSummary(Deal::withoutGlobalScopes()->findOrFail($ctx['deal']));

        $this->assertFalse($summary['is_projected'], 'The ledger will never record a payout for terms set after settlement.');
        $this->assertSame(0.0, $summary['paid_total']);
        $this->assertTrue($summary['referral']['settled']);
        $this->assertSame([], $summary['referral']['terms']);
    }

    public function test_packages_are_walked_in_id_order_when_referrals_share_a_limited_budget(): void
    {
        $ctx = $this->seedDealWithUpline(1000);
        $referrerId = $this->seedAgent($ctx['company'], $this->seedUser($ctx['company'], 'Partner'));
        $first = $this->seedPackage($ctx['company'], 8000, 'percentage', 5);
        $second = $this->seedPackage($ctx['company'], 8000, 'percentage', 5);
        // Attached in reverse, each claiming more than the deal can carry on its own.
        $this->attachPackage($ctx['deal'], $second);
        $this->attachPackage($ctx['deal'], $first);
        $this->seedAgentPackageRate($ctx['company'], $referrerId, $first, null, null, 'fixed', 90);
        $this->seedAgentPackageRate($ctx['company'], $referrerId, $second, null, null, 'fixed', 90);
        $this->refer($ctx, $referrerId);

        $amounts = $this->previewLegs($ctx['deal'])
            ->where('type', MlmCommissionType::Referral->value)
            ->mapWithKeys(fn ($leg) => [(int) $leg['package_id'] => (float) $leg['amount']]);

        $this->assertGreaterThan($amounts[$second] ?? 0.0, $amounts[$first], 'The lower package id is paid first, whatever order the rows come back in.');
    }

    public function test_a_package_the_referrer_has_no_terms_on_pays_them_nothing(): void
    {
        $ctx = $this->seedDealWithUpline(1000);
        $withTerms = $this->seedPackage($ctx['company'], 8000, 'percentage', 5, 'EUR', 'With terms');
        $without = $this->seedPackage($ctx['company'], 2000, 'percentage', 5, 'EUR', 'Without terms');
        $this->attachPackage($ctx['deal'], $withTerms);
        $this->attachPackage($ctx['deal'], $without);
        $referrerId = $this->seedAgent($ctx['company'], $this->seedUser($ctx['company'], 'Partner'));
        $this->seedAgentPackageRate($ctx['company'], $referrerId, $withTerms, null, null, 'percentage', 1);
        $this->refer($ctx, $referrerId);

        $referrals = $this->previewLegs($ctx['deal'])->where('type', MlmCommissionType::Referral->value);

        $this->assertCount(1, $referrals);
        $this->assertSame($withTerms, (int) $referrals->first()['package_id']);
    }

    public function test_the_partners_property_terms_do_not_apply_to_a_package_deal(): void
    {
        $ctx = $this->seedDealWithUpline(1000);
        $packageId = $this->seedPackage($ctx['company'], 8000, 'percentage', 5);
        $this->attachPackage($ctx['deal'], $packageId);
        $referrerId = $this->seedAgent($ctx['company'], $this->seedUser($ctx['company'], 'Partner'));
        $this->refer($ctx, $referrerId, 'fixed', 15);

        $this->assertNull(
            $this->referral($this->previewLegs($ctx['deal'])),
            'Referral commission is specific to the package: a deal that has one is not paid from the property terms.'
        );
    }

    public function test_package_terms_apply_even_when_the_package_pays_the_closer_nothing_itself(): void
    {
        $ctx = $this->seedDealWithUpline(1000);
        // No commission on the package, so the closer is paid by level; the
        // referral still follows the package it was sold on.
        $packageId = $this->seedPackage($ctx['company'], 8000);
        $this->attachPackage($ctx['deal'], $packageId);
        $referrerId = $this->seedAgent($ctx['company'], $this->seedUser($ctx['company'], 'Partner'));
        $this->seedAgentPackageRate($ctx['company'], $referrerId, $packageId, null, null, 'percentage', 1);
        $this->refer($ctx, $referrerId);

        $legs = $this->previewLegs($ctx['deal']);

        $this->assertSame(30.0, (float) $legs->firstWhere('type', MlmCommissionType::Agent->value)['amount']);
        $this->assertSame(40.0, (float) $this->referral($legs)['amount'], '1% of 8000 is 80, capped at the 40 the company holds.');
        $this->assertSame($packageId, (int) $this->referral($legs)['package_id']);
    }

    public function test_referrals_across_packages_are_held_to_what_the_deal_can_carry(): void
    {
        $ctx = $this->seedDealWithUpline(1000);
        $first = $this->seedPackage($ctx['company'], 8000, 'percentage', 5, 'EUR', 'First');
        $second = $this->seedPackage($ctx['company'], 8000, 'percentage', 5, 'EUR', 'Second');
        $this->attachPackage($ctx['deal'], $first);
        $this->attachPackage($ctx['deal'], $second);
        $referrerId = $this->seedAgent($ctx['company'], $this->seedUser($ctx['company'], 'Partner'));
        $this->seedAgentPackageRate($ctx['company'], $referrerId, $first, null, null, 'percentage', 1);
        $this->seedAgentPackageRate($ctx['company'], $referrerId, $second, null, null, 'fixed', 60);
        $this->refer($ctx, $referrerId);

        $amounts = $this->previewLegs($ctx['deal'])
            ->where('type', MlmCommissionType::Referral->value)
            ->pluck('amount', 'package_id')
            ->map(fn ($amount) => (float) $amount);

        $this->assertSame(80.0, $amounts[$first]);
        $this->assertSame(20.0, $amounts[$second], 'The 100 the deal can carry less the 80 already paid.');
    }

    public function test_one_row_holds_what_an_agent_earns_as_closer_and_as_referrer(): void
    {
        $ctx = $this->seedDealWithUpline(1000);
        $packageId = $this->seedPackage($ctx['company'], 8000, 'percentage', 5);
        $this->attachPackage($ctx['deal'], $packageId);
        // The closer also referred this deal: one row sets both roles.
        $this->seedAgentPackageRate($ctx['company'], $ctx['agent'], $packageId, 'fixed', 100, 'percentage', 1);
        $this->refer($ctx, $ctx['agent']);

        $legs = $this->previewLegs($ctx['deal'])->where('agent_id', $ctx['agent']);

        $this->assertSame(
            [MlmCommissionType::Agent->value => 100.0, MlmCommissionType::Referral->value => 80.0],
            $legs->mapWithKeys(fn ($leg) => [$leg['type'] => (float) $leg['amount']])->all()
        );
    }

    public function test_a_closer_override_alone_earns_the_referrer_nothing_as_referrer(): void
    {
        $ctx = $this->seedDealWithUpline(1000);
        $packageId = $this->seedPackage($ctx['company'], 8000, 'percentage', 5);
        $this->attachPackage($ctx['deal'], $packageId);
        $referrerId = $this->seedAgent($ctx['company'], $this->seedUser($ctx['company'], 'Partner'));
        $this->seedAgentPackageRate($ctx['company'], $referrerId, $packageId, 'fixed', 100);
        $this->refer($ctx, $referrerId);

        $this->assertNull($this->referral($this->previewLegs($ctx['deal'])));
    }

    public function test_a_referral_only_row_leaves_the_closer_on_the_package_default(): void
    {
        $ctx = $this->seedDealWithUpline(1000);
        $packageId = $this->seedPackage($ctx['company'], 8000, 'percentage', 5);
        $this->attachPackage($ctx['deal'], $packageId);
        $this->seedAgentPackageRate($ctx['company'], $ctx['agent'], $packageId, null, null, 'fixed', 10);
        $this->refer($ctx, $ctx['agent']);

        $legs = $this->previewLegs($ctx['deal'])->where('agent_id', $ctx['agent']);

        $this->assertSame(400.0, (float) $legs->firstWhere('type', MlmCommissionType::Agent->value)['amount'], '5% of 8000, the package default.');
        $this->assertSame(10.0, (float) $legs->firstWhere('type', MlmCommissionType::Referral->value)['amount']);
    }

    public function test_the_deals_override_replaces_the_package_terms_with_one_leg_on_the_deal_value(): void
    {
        $ctx = $this->seedDealWithUpline(1000);
        $packageId = $this->seedPackage($ctx['company'], 8000, 'percentage', 5);
        $this->attachPackage($ctx['deal'], $packageId);
        $referrerId = $this->seedAgent($ctx['company'], $this->seedUser($ctx['company'], 'Partner'));
        $this->seedAgentPackageRate($ctx['company'], $referrerId, $packageId, null, null, 'percentage', 1);
        $this->refer($ctx, $referrerId, null, null, 'percentage', 3);

        $referrals = $this->previewLegs($ctx['deal'])->where('type', MlmCommissionType::Referral->value);

        $this->assertCount(1, $referrals);
        $this->assertSame(30.0, (float) $referrals->first()['amount'], '3% of the 1000 deal.');
        $this->assertNull($referrals->first()['package_id']);
    }

    public function test_distribute_writes_the_referral_leg_against_its_package(): void
    {
        $ctx = $this->seedDealWithUpline(1000);
        $packageId = $this->seedPackage($ctx['company'], 8000, 'percentage', 5);
        $this->attachPackage($ctx['deal'], $packageId);
        $referrerId = $this->seedAgent($ctx['company'], $this->seedUser($ctx['company'], 'Partner'));
        $this->seedAgentPackageRate($ctx['company'], $referrerId, $packageId, null, null, 'percentage', 1);
        $this->refer($ctx, $referrerId);

        $this->distribute($ctx['deal']);

        $leg = MlmCommission::where('deal_id', $ctx['deal'])->where('type', MlmCommissionType::Referral->value)->first();
        $this->assertSame($referrerId, (int) $leg->agent_id);
        $this->assertSame($packageId, (int) $leg->package_id);
        $this->assertSame(80.0, (float) $leg->amount);
    }

    public function test_referral_leg_is_not_written_while_the_feature_flag_is_off(): void
    {
        $ctx = $this->seedDealWithUpline(1000);
        $referrerId = $this->seedAgent($ctx['company'], $this->seedUser($ctx['company'], 'Partner'));
        $this->refer($ctx, $referrerId, 'fixed', 50);
        $this->setFeatureFlag('crm.partner-referral-commission', false);

        $this->distribute($ctx['deal']);

        $legs = MlmCommission::where('deal_id', $ctx['deal'])->get();

        $this->assertNull($legs->firstWhere('type', MlmCommissionType::Referral), 'No referral leg with the flag off.');
        $this->assertSame(40.0, (float) $legs->firstWhere('type', MlmCommissionType::System)->amount, 'The company keeps the whole remainder, as before the feature.');
        $this->assertNull(
            app(MlmCommissionService::class)->getCommissionSummary(Deal::withoutGlobalScopes()->findOrFail($ctx['deal']))['referral']
        );
    }

    public function test_referral_room_uses_the_rounded_closer_and_upline_amounts(): void
    {
        // 10% of 100.12 rounds to 10.01; the closer and upline legs round to 3.00 each.
        $ctx = $this->seedDealWithUpline(100.12);
        $referrerId = $this->seedAgent($ctx['company'], $this->seedUser($ctx['company'], 'Partner'));
        $this->refer($ctx, $referrerId, 'fixed', 5);

        $legs = $this->previewLegs($ctx['deal']);

        $this->assertSame(4.01, (float) $this->referral($legs)['amount']);
        $this->assertSame(10.01, round((float) $legs->sum('amount'), 2), 'The legs never add up to more than the ceiling.');
    }

    public function test_a_referrer_from_another_company_is_ignored(): void
    {
        $ctx = $this->seedDealWithUpline(1000);
        $otherCompany = $this->seedCompany();
        $foreignReferrer = $this->seedAgent($otherCompany, $this->seedUser($otherCompany, 'Foreign partner'));
        $this->refer($ctx, $foreignReferrer, 'percentage', 2);

        $legs = $this->previewLegs($ctx['deal']);

        $this->assertNull($this->referral($legs));
        $this->assertSame(40.0, (float) $legs->firstWhere('type', MlmCommissionType::System->value)['amount']);
    }

    public function test_referrer_who_closed_the_deal_gets_both_legs(): void
    {
        $ctx = $this->seedDealWithUpline(1000);
        $this->refer($ctx, $ctx['agent'], 'percentage', 2);

        $legs = $this->previewLegs($ctx['deal'])->where('agent_id', $ctx['agent'])
            ->where('type', '!=', MlmCommissionType::System->value);

        $this->assertSame([MlmCommissionType::Agent->value, MlmCommissionType::Referral->value], $legs->pluck('type')->values()->all());
        $this->assertSame(50.0, round((float) $legs->sum('amount'), 2));
    }

    public function test_max_referral_amount_is_the_ceiling_share_of_the_deal_value(): void
    {
        $ctx = $this->seedDealWithUpline(1000);
        $service = app(MlmCommissionService::class);

        $this->assertSame(100.0, $service->maxReferralAmount(Deal::withoutGlobalScopes()->findOrFail($ctx['deal'])), '10% of 1000.');

        $empty = $this->seedDealWithUpline(0);

        $this->assertSame(0.0, $service->maxReferralAmount(Deal::withoutGlobalScopes()->findOrFail($empty['deal'])));
    }

    public function test_the_deal_panel_describes_the_terms_in_force_and_what_was_paid(): void
    {
        $ctx = $this->seedDealWithUpline(1000);
        $packageId = $this->seedPackage($ctx['company'], 8000, 'percentage', 5, 'EUR', 'Gold package');
        $this->attachPackage($ctx['deal'], $packageId);
        $referrerId = $this->seedAgent($ctx['company'], $this->seedUser($ctx['company'], 'Pat Partner'));
        $this->seedAgentPackageRate($ctx['company'], $referrerId, $packageId, null, null, 'percentage', 1);
        $this->refer($ctx, $referrerId);
        $service = app(MlmCommissionService::class);

        $projected = $service->getCommissionSummary(Deal::withoutGlobalScopes()->findOrFail($ctx['deal']))['referral'];

        $this->assertSame('Pat Partner', $projected['referrer_name']);
        $this->assertFalse($projected['settled']);
        $this->assertSame(100.0, $projected['max_amount']);
        $this->assertSame(80.0, $projected['paid_total']);
        $this->assertSame(
            [['source' => 'package', 'package_id' => $packageId, 'package_name' => 'Gold package', 'type' => 'percentage', 'value' => 1.0, 'amount' => 80.0, 'capped' => false]],
            $projected['terms']
        );

        $this->distribute($ctx['deal']);
        // The rule changes after the deal has been paid.
        DB::table('agent_package_commission_rates')->where('agent_id', $referrerId)->update(['referral_commission_value' => 5]);

        $settled = $service->getCommissionSummary(Deal::withoutGlobalScopes()->findOrFail($ctx['deal']))['referral'];

        $this->assertTrue($settled['settled']);
        $this->assertSame(80.0, $settled['paid_total']);
        $this->assertSame('recorded', $settled['terms'][0]['source']);
        $this->assertNull($settled['terms'][0]['value'], 'A settled deal shows what was paid, not today\'s rule.');
    }

    /**
     * Makes $referrerId the partner who referred this deal's lead, with their own
     * terms on deals that have no package and, optionally, an override on the deal.
     *
     * @param  array{company: int, deal: int}  $ctx
     */
    private function refer(
        array $ctx,
        int $referrerId,
        ?string $partnerType = null,
        ?float $partnerValue = null,
        ?string $dealType = null,
        ?float $dealValue = null,
    ): void {
        $this->setFeatureFlag('crm.partner-referral-commission', true);

        DB::table('lead_agents')->where('id', $referrerId)->update([
            'referral_commission_type' => $partnerType,
            'referral_commission_value' => $partnerValue,
            'is_partner' => true,
        ]);

        $leadId = DB::table('leads')->insertGetId([
            'company_id' => $ctx['company'],
            'referred_by_agent_id' => $referrerId,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('deals')->where('id', $ctx['deal'])->update([
            'lead_id' => $leadId,
            'referral_commission_type' => $dealType,
            'referral_commission_value' => $dealValue,
        ]);
    }
}
