<?php

namespace Tests\Feature\PackageCommission;

use App\Models\Deal;
use App\Models\MlmCommission;
use App\Services\MlmCommissionService;
use Illuminate\Support\Facades\Config;
use Tests\PackageCommissionTestCase;

/**
 * Commissions must always land in the company's currency.
 *
 * deals.value is stored in the deal's own currency; deals.exchange_rate is the
 * snapshotted rate to convert that into company currency (the same convention
 * Payment/Expense/Invoice already use: amount * exchange_rate). packages.value
 * is stored in the package's own currency (packages.currency), with no
 * snapshot — converted via a live Currency lookup instead, since a package is
 * catalog pricing, not a completed transaction with a "rate at the time".
 */
class CommissionCurrencyTest extends PackageCommissionTestCase
{
    /** @return array{company: int, agent: int} */
    private function seedAgentWithLevel(): array
    {
        Config::set('mlm.max_commission_percentage', 10);

        $companyId = $this->seedCompany();
        $this->seedMlmSettings($companyId, 10);

        $bronze = $this->seedLevel($companyId, 'Bronze', 1, 5);
        $agentId = $this->seedAgent($companyId, $this->seedUser($companyId, 'Agent'));
        $this->seedLevelHistory($companyId, $agentId, $bronze);

        return ['company' => $companyId, 'agent' => $agentId];
    }

    private function distribute(int $dealId): void
    {
        app(MlmCommissionService::class)->distribute(
            Deal::withoutGlobalScopes()->findOrFail($dealId)
        );
    }

    public function test_level_based_commission_converts_a_foreign_currency_deal(): void
    {
        $ctx = $this->seedAgentWithLevel();
        // A USD currency row with a rate to this (EUR-implicit) company: $1 = €0.90.
        $usdId = $this->seedCurrency($ctx['company'], 'USD', 0.90);
        $dealId = $this->seedDeal($ctx['company'], $ctx['agent'], 1000, $usdId, 0.90);

        $this->distribute($dealId);

        $leg = MlmCommission::where('deal_id', $dealId)->where('type', 'agent')->firstOrFail();

        // 5% of (1000 USD * 0.90) = 5% of 900 EUR = 45.00, NOT 5% of 1000 = 50.00.
        $this->assertSame(45.0, (float) $leg->amount);
    }

    public function test_null_exchange_rate_behaves_as_untouched_same_currency(): void
    {
        $ctx = $this->seedAgentWithLevel();
        $dealId = $this->seedDeal($ctx['company'], $ctx['agent'], 1000, null, null);

        $this->distribute($dealId);

        $leg = MlmCommission::where('deal_id', $dealId)->where('type', 'agent')->firstOrFail();

        // No exchange_rate snapshotted (same currency, or never touched) —
        // must not silently zero out or otherwise distort the amount.
        $this->assertSame(50.0, (float) $leg->amount);
    }

    public function test_package_percentage_converts_the_packages_own_currency(): void
    {
        $ctx = $this->seedAgentWithLevel();
        $this->seedCurrency($ctx['company'], 'USD', 0.90);
        $dealId = $this->seedDeal($ctx['company'], $ctx['agent'], 1000);
        // Package priced in USD: value 8000, at 5% = 400 USD -> 360 EUR.
        $packageId = $this->seedPackage($ctx['company'], 8000, 'percentage', 5, 'USD');
        $this->attachPackage($dealId, $packageId);

        $this->distribute($dealId);

        $leg = MlmCommission::where('deal_id', $dealId)->firstOrFail();
        $this->assertSame(360.0, (float) $leg->amount);
    }

    public function test_package_fixed_fee_is_not_converted(): void
    {
        // A fixed fee is entered directly in company currency by convention
        // (the settings-page input is labelled with the company's symbol, not
        // the package's) — applying the package's exchange rate to it would
        // double-convert an already-correct number.
        $ctx = $this->seedAgentWithLevel();
        $this->seedCurrency($ctx['company'], 'USD', 0.90);
        $dealId = $this->seedDeal($ctx['company'], $ctx['agent'], 1000);
        $packageId = $this->seedPackage($ctx['company'], 8000, 'fixed', 500, 'USD');
        $this->attachPackage($dealId, $packageId);

        $this->distribute($dealId);

        $leg = MlmCommission::where('deal_id', $dealId)->firstOrFail();
        $this->assertSame(500.0, (float) $leg->amount);
    }

    public function test_package_currency_with_no_matching_currency_row_defaults_to_no_conversion(): void
    {
        // No `currencies` row for 'GBP' at all — an unmaintained/unknown rate
        // must fail safe (rate = 1), not throw and not silently zero the leg.
        $ctx = $this->seedAgentWithLevel();
        $dealId = $this->seedDeal($ctx['company'], $ctx['agent'], 1000);
        $packageId = $this->seedPackage($ctx['company'], 8000, 'percentage', 5, 'GBP');
        $this->attachPackage($dealId, $packageId);

        $this->distribute($dealId);

        $leg = MlmCommission::where('deal_id', $dealId)->firstOrFail();
        $this->assertSame(400.0, (float) $leg->amount);
    }

    public function test_package_in_the_companys_own_currency_is_a_no_op_conversion(): void
    {
        $ctx = $this->seedAgentWithLevel();
        // Company's own currency conventionally carries exchange_rate = 1.
        $this->seedCurrency($ctx['company'], 'EUR', 1.0);
        $dealId = $this->seedDeal($ctx['company'], $ctx['agent'], 1000);
        $packageId = $this->seedPackage($ctx['company'], 8000, 'percentage', 5, 'EUR');
        $this->attachPackage($dealId, $packageId);

        $this->distribute($dealId);

        $leg = MlmCommission::where('deal_id', $dealId)->firstOrFail();
        $this->assertSame(400.0, (float) $leg->amount);
    }
}
