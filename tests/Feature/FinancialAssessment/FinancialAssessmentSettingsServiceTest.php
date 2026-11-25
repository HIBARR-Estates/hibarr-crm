<?php

namespace Tests\Feature\FinancialAssessment;

use App\Enums\FinancialAssessmentSource;
use App\Models\FinancialAssessmentKind;
use App\Models\LeadFinancialSummary;
use App\Services\FinancialAssessment\AssessmentService;
use App\Services\FinancialAssessment\FinancialAssessmentSettingsService;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\ValidationException;
use Tests\FinancialAssessmentTestCase;

class FinancialAssessmentSettingsServiceTest extends FinancialAssessmentTestCase
{
    private FinancialAssessmentSettingsService $settings;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow('2026-11-12 10:00:00');
        $this->settings = app(FinancialAssessmentSettingsService::class);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_the_payload_lists_kinds_with_their_types_crypto_assets_and_defaults(): void
    {
        $payload = $this->settings->payload($this->companyId);

        $this->assertSame(['income', 'saving_asset', 'funding_source', 'commitment'], array_column($payload['kinds'], 'key'));
        $income = $payload['kinds'][0];
        $this->assertSame('income', $income['role']);
        $this->assertSame(['salary', 'rent', 'pension', 'business_income'], array_column($income['types'], 'key'));
        $this->assertSame('monthly', $income['types'][0]['default_frequency']);
        $this->assertSame(5, count($payload['crypto_assets']));
        $this->assertSame('EUR', $payload['defaults']['reporting_currency']);
        $this->assertSame(90, $payload['defaults']['refresh_after_days']);
        $this->assertSame(['EUR', 'GBP', 'USD'], $payload['defaults']['currencies']);
    }

    public function test_a_new_kind_gets_a_unique_key_and_works_in_the_calculation_by_its_role(): void
    {
        $first = $this->settings->createKind($this->companyId, '  Insurance   payouts ', 'funding');
        $second = $this->settings->createKind($this->companyId, 'Insurance payouts', 'funding');
        $type = $this->settings->createType($this->companyId, $first['id'], 'Life insurance', 'once', 'likely');

        $this->assertSame('insurance_payouts', $first['key']);
        $this->assertSame('insurance_payouts_2', $second['key']);
        $this->assertSame('Insurance payouts', $first['label']);
        $this->assertFalse($first['is_system']);
        $this->assertSame('life_insurance', $type['key']);

        // The new type is usable straight away and is counted as funding.
        $service = app(AssessmentService::class);
        $draft = $service->startDraft($this->makeLead(), null, FinancialAssessmentSource::Manual);
        $service->addLine($draft, 'life_insurance', ['amount' => 20000, 'certainty' => 'confirmed']);
        $final = $service->finalise($draft);

        $this->assertEquals(20000.0, $final->totals['funding_total']);
        $this->assertEquals(20000.0, $final->totals['available_now']);
    }

    public function test_an_unknown_role_is_rejected(): void
    {
        $this->expectException(ValidationException::class);
        $this->settings->createKind($this->companyId, 'Odd', 'banana');
    }

    public function test_renaming_changes_the_label_but_never_the_key_or_the_role(): void
    {
        $kind = FinancialAssessmentKind::withoutGlobalScopes()->where('key', 'income')->first();

        $updated = $this->settings->updateKind($this->companyId, $kind->id, ['label' => 'Earnings', 'role' => 'asset', 'key' => 'hacked']);
        $type = $this->settings->updateType($this->companyId, (int) DB::table('financial_assessment_line_types')->where('key', 'salary')->value('id'), [
            'label' => 'Wages', 'key' => 'hacked', 'kind_id' => 999, 'default_frequency' => 'yearly', 'default_certainty' => null,
        ]);

        $this->assertSame('Earnings', $updated['label']);
        $this->assertSame('income', $updated['key']);
        $this->assertSame('income', $updated['role']);
        $this->assertSame('Wages', $type['label']);
        $this->assertSame('salary', $type['key']);
        $this->assertSame($kind->id, $type['kind_id']);
        $this->assertSame('yearly', $type['default_frequency']);
        $this->assertNull($type['default_certainty']);
    }

    public function test_a_type_can_be_deactivated_and_its_usage_is_counted(): void
    {
        $service = app(AssessmentService::class);
        $draft = $service->startDraft($this->makeLead());
        $service->addLine($draft, 'bank', ['amount' => 10]);
        $service->addLine($draft, 'bank', ['amount' => 20]);

        $bankId = (int) DB::table('financial_assessment_line_types')->where('key', 'bank')->value('id');
        $row = $this->settings->updateType($this->companyId, $bankId, ['is_active' => false]);

        $this->assertFalse($row['is_active']);
        $this->assertSame(2, $row['line_count']);
    }

    public function test_settings_of_another_company_cannot_be_touched(): void
    {
        DB::table('companies')->insert(['id' => 2, 'company_name' => 'Other', 'currency_id' => 1]);
        $otherKind = $this->settings->createKind(2, 'Secret', 'income');

        $this->expectException(ModelNotFoundException::class);
        $this->settings->updateKind($this->companyId, $otherKind['id'], ['label' => 'Stolen']);
    }

    public function test_crypto_asset_tickers_are_validated(): void
    {
        $asset = $this->settings->createCryptoAsset($this->companyId, ' ada ', 'cardano', 'Cardano');
        $this->assertSame('ADA', $asset['ticker']);

        foreach (['ADA', 'EUR', 'a', 'TOO-LONG-TICKER', 'bad ticker'] as $bad) {
            try {
                $this->settings->createCryptoAsset($this->companyId, $bad, 'x', 'X');
                $this->fail("Expected the ticker \"{$bad}\" to be rejected");
            } catch (ValidationException $e) {
                $this->assertArrayHasKey('ticker', $e->errors());
            }
        }
    }

    public function test_changing_the_defaults_moves_the_due_date_of_existing_summaries(): void
    {
        $service = app(AssessmentService::class);
        $lead = $this->makeLead();
        $draft = $service->startDraft($lead);
        $service->addLine($draft, 'bank', ['amount' => 100]);
        $service->finalise($draft);

        $result = $this->settings->updateDefaults($this->companyId, $this->userId, 'usd', '60');

        $this->assertSame(['reporting_currency' => 'USD', 'refresh_after_days' => 60], $result);
        $this->assertSame('USD', $service->reportingCurrency($this->companyId));
        $this->assertSame(60, $service->refreshAfterDays($this->companyId));
        $this->assertSame('2027-01-11', LeadFinancialSummary::withoutGlobalScopes()->find($lead->id)->refresh_due_on->toDateString());
    }

    public function test_invalid_defaults_are_rejected(): void
    {
        foreach ([['EUR', 3], ['EUR', 5000], ['BTC', 90], ['CHF', 90], ['EU', 90]] as [$currency, $days]) {
            try {
                $this->settings->updateDefaults($this->companyId, $this->userId, $currency, $days);
                $this->fail("Expected {$currency}/{$days} to be rejected");
            } catch (ValidationException $e) {
                $this->assertNotEmpty($e->errors());
            }
        }
    }

    public function test_the_rate_test_explains_why_it_cannot_fetch(): void
    {
        Config::set('services.crypto_rates', ['provider' => 'coingecko', 'coingecko' => ['api_key' => null], 'cache_seconds' => 60]);
        $this->assertSame('no_api_key', $this->settings->testRateFetch($this->companyId)['reason']);

        Config::set('services.crypto_rates', ['provider' => 'coingecko', 'coingecko' => ['api_key' => 'k', 'base_url' => 'https://api.coingecko.test/v3'], 'cache_seconds' => 60]);
        DB::table('financial_crypto_assets')->update(['is_active' => false]);
        $this->assertSame('no_assets', $this->settings->testRateFetch($this->companyId)['reason']);

        // The provider answers with nothing at first, then with a price.
        $answer = [];
        Http::fake(function () use (&$answer) {
            return Http::response($answer);
        });
        DB::table('financial_crypto_assets')->where('ticker', 'BTC')->update(['is_active' => true]);
        $this->assertSame('no_rate', $this->settings->testRateFetch($this->companyId)['reason']);

        Cache::flush();
        $answer = ['bitcoin' => ['eur' => 60000]];
        $ok = $this->settings->testRateFetch($this->companyId);
        $this->assertTrue($ok['ok']);
        $this->assertEquals(60000, $ok['rate']);
        $this->assertSame('BTC', $ok['ticker']);
    }
}
