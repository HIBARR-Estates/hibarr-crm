<?php

namespace Tests\Feature\PackageCommission;

use App\Models\Deal;
use App\Models\MlmCommission;
use App\Services\MlmCommissionService;
use App\Services\MlmNotificationService;
use Illuminate\Support\Facades\Config;
use ReflectionMethod;
use Tests\PackageCommissionTestCase;

/**
 * A fixed-fee leg has a null percentage. Every surface that renders a rate has
 * to cope with that — and the two that fail do so silently rather than erroring.
 */
class FixedFeeDisplayTest extends PackageCommissionTestCase
{
    /** @return array{company: int, agent: int, deal: int} */
    private function seedFixedFeeLeg(float $fee = 250, string $packageCurrency = 'EUR'): array
    {
        Config::set('mlm.max_commission_percentage', 10);

        $companyId = $this->seedCompany();
        $this->seedMlmSettings($companyId, 10);

        $bronze = $this->seedLevel($companyId, 'Bronze', 1, 3);
        $agentId = $this->seedAgent($companyId, $this->seedUser($companyId, 'Agent'));
        $this->seedLevelHistory($companyId, $agentId, $bronze);

        $dealId = $this->seedDeal($companyId, $agentId, 1000);
        $packageId = $this->seedPackage($companyId, 8000, 'fixed', $fee, $packageCurrency);
        $this->attachPackage($dealId, $packageId);

        app(MlmCommissionService::class)->distribute(
            Deal::withoutGlobalScopes()->findOrFail($dealId)
        );

        return ['company' => $companyId, 'agent' => $agentId, 'deal' => $dealId];
    }

    public function test_fixed_fee_leg_stores_a_null_percentage(): void
    {
        $ctx = $this->seedFixedFeeLeg();

        $leg = MlmCommission::where('deal_id', $ctx['deal'])->firstOrFail();

        $this->assertNull($leg->percentage);
        $this->assertSame(250.0, (float) $leg->amount);
    }

    public function test_the_leg_carries_no_currency_of_its_own(): void
    {
        // The package is priced in a currency the company does not use. The
        // commission is still denominated by the deal/company, so nothing about
        // the package's price currency may be stamped onto the leg.
        $ctx = $this->seedFixedFeeLeg(250, 'GBP');

        $leg = MlmCommission::where('deal_id', $ctx['deal'])->firstOrFail();

        $this->assertArrayNotHasKey('currency', $leg->getAttributes());
    }

    public function test_notification_context_leaves_percentage_null_for_a_fixed_fee(): void
    {
        $ctx = $this->seedFixedFeeLeg();
        $leg = MlmCommission::where('deal_id', $ctx['deal'])->firstOrFail();

        $method = new ReflectionMethod(MlmNotificationService::class, 'commissionContext');
        $method->setAccessible(true);
        $context = $method->invoke(app(MlmNotificationService::class), $leg);

        // number_format((float) null, 2) yields "0.00", which is TRUTHY in PHP.
        // MlmEventNotification guards this key with !empty(), so a formatted
        // zero here would print a bogus "Percentage: 0.00%" row on every
        // fixed-fee commission email.
        $this->assertNull($context['percentage']);
        $this->assertEmpty($context['percentage'] ?? null);
    }

    public function test_notification_context_still_formats_a_real_percentage(): void
    {
        Config::set('mlm.max_commission_percentage', 10);

        $companyId = $this->seedCompany();
        $this->seedMlmSettings($companyId, 10);
        $bronze = $this->seedLevel($companyId, 'Bronze', 1, 3);
        $agentId = $this->seedAgent($companyId, $this->seedUser($companyId, 'Agent'));
        $this->seedLevelHistory($companyId, $agentId, $bronze);

        $dealId = $this->seedDeal($companyId, $agentId, 1000);
        $packageId = $this->seedPackage($companyId, 8000, 'percentage', 5);
        $this->attachPackage($dealId, $packageId);

        app(MlmCommissionService::class)->distribute(
            Deal::withoutGlobalScopes()->findOrFail($dealId)
        );

        $leg = MlmCommission::where('deal_id', $dealId)->firstOrFail();

        $method = new ReflectionMethod(MlmNotificationService::class, 'commissionContext');
        $method->setAccessible(true);
        $context = $method->invoke(app(MlmNotificationService::class), $leg);

        $this->assertSame('5.00', $context['percentage']);
    }
}
