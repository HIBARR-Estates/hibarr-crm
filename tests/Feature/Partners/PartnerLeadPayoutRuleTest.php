<?php

namespace Tests\Feature\Partners;

use App\Enums\MlmCommissionType;
use App\Models\AgentPackageCommissionRate;
use App\Models\Deal;
use App\Models\LeadAgent;
use App\Models\Package;
use App\Services\MlmCommissionService;
use App\Services\Partner\PartnerLeadService;
use ReflectionMethod;
use Tests\Concerns\SetsFeatureFlags;
use Tests\TestCase;

/**
 * The leads view leaves out deals that pay the partner nothing. Mirrors
 * MlmCommissionService::packageLegs(): package pricing applies when any
 * attached package carries a commission_type, and then it owns the whole
 * payout. Models are built in memory; no database is touched.
 */
class PartnerLeadPayoutRuleTest extends TestCase
{
    use SetsFeatureFlags;

    private function package(int $id, ?string $type, float $value = 0): Package
    {
        $package = new Package(['commission_type' => $type, 'commission_value' => $value, 'value' => 1000]);
        $package->id = $id;

        return $package;
    }

    private function override(int $packageId, string $type): AgentPackageCommissionRate
    {
        $rate = new AgentPackageCommissionRate(['package_id' => $packageId, 'commission_type' => $type]);
        $rate->package_id = $packageId;

        return $rate;
    }

    /**
     * @param  array<int, Package>  $packages
     * @param  array<int, AgentPackageCommissionRate>  $overrides
     * @param  array<int, bool>  $paysByPackage  what the commission engine says each remaining package pays
     * @param  array<int, array<string, mixed>>  $preview
     */
    private function paysNothing(array $packages, array $overrides = [], array $paysByPackage = [], array $preview = []): bool
    {
        $engine = $this->createMock(MlmCommissionService::class);
        $engine->method('preview')->willReturn($preview);
        $engine->method('resolvePackageCommission')->willReturnCallback(
            fn (Package $package) => ($paysByPackage[$package->id] ?? true)
                ? ['amount' => 50.0, 'percentage' => null]
                : null
        );

        $deal = new Deal;
        $deal->setRelation('packages', collect($packages));

        $agent = new LeadAgent;
        $agent->id = 7;

        $method = new ReflectionMethod(PartnerLeadService::class, 'paysNothing');
        $method->setAccessible(true);

        return $method->invoke(new PartnerLeadService($engine), $deal, $agent, collect($overrides)->keyBy('package_id'));
    }

    public function test_a_deal_with_no_packages_pays_through_the_level_split(): void
    {
        $this->assertFalse($this->paysNothing([]));
    }

    public function test_packages_with_no_commission_type_do_not_make_it_a_package_deal(): void
    {
        $this->assertFalse($this->paysNothing([$this->package(1, null)]));
    }

    public function test_a_single_none_package_pays_nothing(): void
    {
        $this->assertTrue($this->paysNothing([$this->package(1, 'none')]));
    }

    public function test_every_package_none_pays_nothing(): void
    {
        $this->assertTrue($this->paysNothing([$this->package(1, 'none'), $this->package(2, 'none')]));
    }

    public function test_one_paying_package_among_none_ones_keeps_the_deal(): void
    {
        $this->assertFalse($this->paysNothing([$this->package(1, 'none'), $this->package(2, 'percentage', 5)]));
    }

    public function test_a_percentage_package_that_resolves_to_zero_pays_nothing(): void
    {
        $this->assertTrue($this->paysNothing([$this->package(1, 'percentage', 0)], [], [1 => false]));
    }

    public function test_a_per_agent_override_to_none_beats_the_package_default(): void
    {
        $this->assertTrue($this->paysNothing(
            [$this->package(1, 'percentage', 5)],
            [$this->override(1, 'none')],
        ));
    }

    public function test_a_referral_leg_keeps_a_deal_the_package_would_not_pay(): void
    {
        $this->setFeatureFlag('crm.partner-referral-commission', true);

        $this->assertFalse($this->paysNothing(
            [$this->package(1, 'none')],
            [],
            [],
            [['type' => MlmCommissionType::Referral->value, 'agent_id' => 7, 'amount' => 80]],
        ));
    }

    public function test_a_referral_leg_is_ignored_while_the_feature_flag_is_off(): void
    {
        $this->setFeatureFlag('crm.partner-referral-commission', false);

        $this->assertTrue($this->paysNothing(
            [$this->package(1, 'none')],
            [],
            [],
            [['type' => MlmCommissionType::Referral->value, 'agent_id' => 7, 'amount' => 80]],
        ));
    }

    public function test_a_settled_deal_is_judged_by_its_recorded_referral_leg_not_a_fresh_preview(): void
    {
        $this->setFeatureFlag('crm.partner-referral-commission', true);

        $engine = $this->createMock(MlmCommissionService::class);
        // Today's settings would pay a referral, but the ledger recorded none.
        $engine->method('preview')->willReturn([
            ['type' => MlmCommissionType::Referral->value, 'agent_id' => 7, 'amount' => 80],
        ]);

        $settled = new Deal;
        $settled->id = 5;
        $settled->commission_locked = true;

        $agent = new LeadAgent;
        $agent->id = 7;

        $method = new ReflectionMethod(PartnerLeadService::class, 'referralPays');
        $method->setAccessible(true);
        $service = new PartnerLeadService($engine);

        $this->assertFalse($method->invoke($service, $settled, $agent, collect()));
        $this->assertTrue($method->invoke($service, $settled, $agent, collect([5])));
    }

    public function test_a_per_agent_override_can_make_a_none_package_pay(): void
    {
        $this->assertFalse($this->paysNothing(
            [$this->package(1, 'none')],
            [$this->override(1, 'fixed')],
        ));
    }
}
