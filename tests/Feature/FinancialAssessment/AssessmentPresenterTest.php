<?php

namespace Tests\Feature\FinancialAssessment;

use App\Enums\FinancialAssessmentSource;
use App\Models\Lead;
use App\Services\FinancialAssessment\AssessmentPresenter;
use App\Services\FinancialAssessment\AssessmentService;
use Carbon\Carbon;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Tests\FinancialAssessmentTestCase;

class AssessmentPresenterTest extends FinancialAssessmentTestCase
{
    private AssessmentService $service;

    private AssessmentPresenter $presenter;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow('2026-11-12 10:00:00');
        Config::set('services.crypto_rates', ['provider' => 'coingecko', 'coingecko' => ['api_key' => null], 'cache_seconds' => 60]);
        $this->service = app(AssessmentService::class);
        $this->presenter = app(AssessmentPresenter::class);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function workspace(Lead $lead): array
    {
        return $this->presenter->workspace($lead, ['view' => true, 'edit' => true]);
    }

    public function test_a_lead_without_assessments_gets_the_vocabulary_and_empty_state(): void
    {
        $payload = $this->workspace($this->makeLead());

        $this->assertNull($payload['summary']);
        $this->assertNull($payload['current']);
        $this->assertNull($payload['draft']);
        $this->assertSame([], $payload['history']);
        $this->assertSame('EUR', $payload['settings']['reporting_currency']);
        $this->assertSame(90, $payload['settings']['refresh_after_days']);
        $this->assertFalse($payload['settings']['crypto_provider_ready']);
        $this->assertSame(['income', 'saving_asset', 'funding_source', 'commitment'], array_column($payload['options']['kinds'], 'key'));
        $this->assertSame(['EUR', 'GBP', 'USD'], $payload['options']['fiat_currencies']);
        $this->assertContains('BTC', $payload['options']['crypto_currencies']);
        $this->assertSame(['view' => true, 'edit' => true], $payload['permissions']);
    }

    public function test_deactivated_types_are_not_offered_for_new_lines(): void
    {
        DB::table('financial_assessment_line_types')->where('key', 'rent')->update(['is_active' => false]);

        $income = $this->workspace($this->makeLead())['options']['kinds'][0];

        $this->assertNotContains('rent', array_column($income['types'], 'key'));
        $this->assertContains('salary', array_column($income['types'], 'key'));
    }

    public function test_a_draft_shows_indicative_totals_and_lines_in_the_reporting_currency(): void
    {
        $lead = $this->makeLead();
        $draft = $this->service->startDraft($lead, $this->userId, FinancialAssessmentSource::Call);
        $this->service->addLine($draft, 'salary', ['amount' => 6500]);
        $this->service->addLine($draft, 'bank', ['amount' => 42000]);

        $payload = $this->workspace($lead);

        $this->assertNull($payload['current']);
        $this->assertSame('draft', $payload['draft']['status']);
        $this->assertSame('call', $payload['draft']['source']);
        $this->assertNull($payload['draft']['totals']);
        $this->assertEquals(42000, $payload['draft']['preview']['totals']['available_now']);
        $this->assertEquals(6500, $payload['draft']['preview']['totals']['income_monthly']);
        $this->assertSame([], $payload['draft']['preview']['missing_rates']);
        $line = $payload['draft']['lines'][0];
        $this->assertSame('salary', $line['type_key']);
        $this->assertSame('income', $line['kind_key']);
        $this->assertSame('income', $line['role']);
        $this->assertSame(6500.0, $line['converted_amount']);
        $this->assertNull($line['previous']);
    }

    public function test_an_update_marks_each_line_with_what_it_was_copied_from(): void
    {
        $lead = $this->makeLead();
        $first = $this->service->startDraft($lead);
        $this->service->addLine($first, 'salary', ['amount' => 6000]);
        $this->service->addLine($first, 'bank', ['amount' => 38000]);
        $this->service->finalise($first, $this->userId);

        $draft = $this->service->startDraft($lead);
        $salary = $draft->lines()->get()->first(fn ($line) => $line->type->key === 'salary');
        $this->service->updateLine($salary, ['amount' => 6500]);
        $this->service->addLine($draft, 'mortgage', ['amount' => 1450]);

        $lines = collect($this->workspace($lead)['draft']['lines'])->keyBy('type_key');

        $this->assertSame(6000.0, $lines['salary']['previous']['amount']);
        $this->assertSame(6500.0, $lines['salary']['amount']);
        $this->assertSame(38000.0, $lines['bank']['previous']['amount']);
        $this->assertSame(38000.0, $lines['bank']['amount']);
        $this->assertNull($lines['mortgage']['previous']);
    }

    public function test_a_draft_with_an_unpriceable_crypto_line_says_which_rate_is_missing(): void
    {
        $lead = $this->makeLead();
        $draft = $this->service->startDraft($lead);
        $this->service->addLine($draft, 'crypto', ['amount' => 0.4, 'currency' => 'BTC']);

        $draftPayload = $this->workspace($lead)['draft'];

        $this->assertNull($draftPayload['preview']['totals']);
        $this->assertSame(['BTC'], $draftPayload['preview']['missing_rates']);
        $this->assertNull($draftPayload['lines'][0]['converted_amount']);
        $this->assertNull($draftPayload['lines'][0]['rate']);
    }

    public function test_a_draft_converts_crypto_at_the_live_indicative_rate(): void
    {
        Config::set('services.crypto_rates', [
            'provider' => 'coingecko',
            'coingecko' => ['api_key' => 'k', 'base_url' => 'https://api.coingecko.test/v3'],
            'cache_seconds' => 60,
        ]);
        Http::fake(['api.coingecko.test/*' => Http::response(['bitcoin' => ['eur' => 60000]])]);

        $lead = $this->makeLead();
        $draft = $this->service->startDraft($lead);
        $this->service->addLine($draft, 'crypto', ['amount' => 0.4, 'currency' => 'BTC']);

        $line = $this->workspace($lead)['draft']['lines'][0];

        $this->assertSame(24000.0, $line['converted_amount']);
        $this->assertSame(60000.0, $line['rate']);
        $this->assertTrue($this->workspace($lead)['settings']['crypto_provider_ready']);
    }

    public function test_the_current_assessment_uses_its_frozen_rates_and_history_lists_the_superseded_ones(): void
    {
        Config::set('services.crypto_rates', ['provider' => 'coingecko', 'coingecko' => ['api_key' => null], 'cache_seconds' => 60]);
        $lead = $this->makeLead();

        $first = $this->service->startDraft($lead);
        $this->service->addLine($first, 'crypto', ['amount' => 1, 'currency' => 'BTC', 'certainty' => 'confirmed']);
        $this->service->finalise($first, $this->userId, ['manual_rates' => ['BTC' => 50000]]);

        Carbon::setTestNow('2026-12-01 10:00:00');
        $second = $this->service->startDraft($lead);
        $this->service->finalise($second, $this->userId, ['manual_rates' => ['BTC' => 55000]]);
        $this->service->verify($second->fresh(), $this->userId);

        $payload = $this->workspace($lead);

        $this->assertNull($payload['draft']);
        $this->assertSame('final', $payload['current']['status']);
        $this->assertNotNull($payload['current']['verified_at']);
        $this->assertSame('Agent', $payload['current']['verified_by']['name']);
        $this->assertSame(55000.0, $payload['current']['lines'][0]['converted_amount']);
        $this->assertSame(['final', 'superseded'], array_column($payload['history'], 'status'));
        $this->assertSame(50000.0, $payload['history'][1]['lines'][0]['converted_amount']);
        $this->assertEquals(55000, $payload['summary']['available_now']);
        $this->assertTrue($payload['summary']['verified']);
    }

    public function test_the_refresh_countdown_turns_into_overdue_after_the_due_date(): void
    {
        $lead = $this->makeLead();
        $draft = $this->service->startDraft($lead);
        $this->service->addLine($draft, 'bank', ['amount' => 100]);
        $this->service->finalise($draft);

        $fresh = $this->workspace($lead)['summary'];
        $this->assertSame('2027-02-10', $fresh['refresh_due_on']);
        $this->assertSame(90, $fresh['days_until_due']);
        $this->assertFalse($fresh['is_refresh_due']);

        Carbon::setTestNow('2027-03-01 09:00:00');
        $late = $this->workspace($lead)['summary'];
        $this->assertSame(-19, $late['days_until_due']);
        $this->assertTrue($late['is_refresh_due']);
    }
}
