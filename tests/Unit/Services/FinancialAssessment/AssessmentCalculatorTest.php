<?php

namespace Tests\Unit\Services\FinancialAssessment;

use App\Enums\FinancialKindRole;
use App\Enums\FinancialLineCertainty as C;
use App\Enums\FinancialLineFrequency as F;
use App\Services\FinancialAssessment\AssessmentCalculator;
use App\Services\FinancialAssessment\AssessmentLineInput;
use Carbon\Carbon;
use Carbon\CarbonImmutable;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;

class AssessmentCalculatorTest extends TestCase
{
    private function line(
        string $type,
        FinancialKindRole $role,
        float $amount,
        F $frequency,
        C $certainty,
        string $currency = 'EUR',
        ?string $availableFrom = null,
        ?string $kind = null,
    ): AssessmentLineInput {
        return new AssessmentLineInput(
            $type,
            $kind ?? $role->value,
            $role,
            $amount,
            $currency,
            $frequency,
            $certainty,
            $availableFrom ? CarbonImmutable::parse($availableFrom) : null,
        );
    }

    /** The nine lines of the approved mockup (assessment of 12 Nov 2026). */
    private function mockupLines(): array
    {
        return [
            $this->line('salary', FinancialKindRole::Income, 6500, F::Monthly, C::Confirmed),
            $this->line('salary', FinancialKindRole::Income, 3100, F::Monthly, C::Confirmed),
            $this->line('rent', FinancialKindRole::Income, 1200, F::Monthly, C::Likely),
            $this->line('bank', FinancialKindRole::Asset, 42000, F::Once, C::Confirmed),
            $this->line('crypto', FinancialKindRole::Asset, 0.40, F::Once, C::Likely, 'BTC'),
            $this->line('property_sale', FinancialKindRole::Funding, 180000, F::Once, C::Likely, 'EUR', '2027-03-01'),
            $this->line('family_gift', FinancialKindRole::Funding, 30000, F::Once, C::Uncertain, 'EUR', '2027-06-01'),
            $this->line('mortgage', FinancialKindRole::Commitment, 1450, F::Monthly, C::Confirmed),
            $this->line('loan_repayment', FinancialKindRole::Commitment, 480, F::Monthly, C::Confirmed),
        ];
    }

    public function test_it_reproduces_the_figures_shown_in_the_approved_mockup(): void
    {
        $totals = (new AssessmentCalculator)->calculate(
            $this->mockupLines(),
            ['BTC' => 60000.0],
            'EUR',
            CarbonImmutable::parse('2026-11-12'),
        );

        $this->assertSame(10800.0, $totals['income_monthly']);
        $this->assertSame(1930.0, $totals['commitments_monthly']);
        $this->assertSame(8870.0, $totals['disposable_monthly']);
        $this->assertSame(66000.0, $totals['assets_total']);
        $this->assertSame(180000.0, $totals['funding_total']);
        $this->assertSame(42000.0, $totals['available_now']);
        $this->assertSame(246000.0, $totals['available_projected']);
        $this->assertSame(30000.0, $totals['uncertain_total']);
        $this->assertSame(1, $totals['calc_version']);
    }

    public function test_crypto_is_converted_at_the_given_rate_and_rounded_to_cents(): void
    {
        $totals = (new AssessmentCalculator)->calculate(
            [$this->line('crypto', FinancialKindRole::Asset, 0.12345678, F::Once, C::Confirmed, 'BTC')],
            ['BTC' => 60000.0],
            'EUR',
            CarbonImmutable::parse('2026-11-12'),
        );

        // 0.12345678 * 60000 = 7407.4068 -> 7407.41
        $this->assertSame(7407.41, $totals['assets_total']);
        $this->assertSame(7407.41, $totals['available_now']);
    }

    public function test_funding_becomes_available_now_only_once_its_date_has_passed(): void
    {
        $sale = $this->line('property_sale', FinancialKindRole::Funding, 180000, F::Once, C::Confirmed, 'EUR', '2027-03-01');
        $calc = new AssessmentCalculator;

        $before = $calc->calculate([$sale], [], 'EUR', CarbonImmutable::parse('2026-11-12'));
        $onTheDay = $calc->calculate([$sale], [], 'EUR', CarbonImmutable::parse('2027-03-01'));

        $this->assertSame(0.0, $before['available_now']);
        $this->assertSame(180000.0, $before['available_projected']);
        $this->assertSame(180000.0, $onTheDay['available_now']);
    }

    public function test_a_line_without_an_available_from_date_is_available_immediately(): void
    {
        $totals = (new AssessmentCalculator)->calculate(
            [$this->line('bank', FinancialKindRole::Asset, 1000, F::Once, C::Confirmed)],
            [],
            'EUR',
            CarbonImmutable::parse('2026-11-12'),
        );

        $this->assertSame(1000.0, $totals['available_now']);
    }

    public function test_yearly_recurring_amounts_are_divided_by_twelve_and_one_off_income_is_left_out(): void
    {
        $totals = (new AssessmentCalculator)->calculate(
            [
                $this->line('dividends', FinancialKindRole::Income, 12000, F::Yearly, C::Confirmed),
                $this->line('bonus', FinancialKindRole::Income, 5000, F::Once, C::Confirmed),
            ],
            [],
            'EUR',
            CarbonImmutable::parse('2026-11-12'),
        );

        $this->assertSame(1000.0, $totals['income_monthly']);
    }

    public function test_uncertain_income_is_reported_separately_but_an_uncertain_commitment_still_counts(): void
    {
        $totals = (new AssessmentCalculator)->calculate(
            [
                $this->line('salary', FinancialKindRole::Income, 4000, F::Monthly, C::Confirmed),
                $this->line('rent', FinancialKindRole::Income, 900, F::Monthly, C::Uncertain),
                $this->line('loan_repayment', FinancialKindRole::Commitment, 300, F::Monthly, C::Uncertain),
            ],
            [],
            'EUR',
            CarbonImmutable::parse('2026-11-12'),
        );

        $this->assertSame(4000.0, $totals['income_monthly']);
        $this->assertSame(900.0, $totals['uncertain_income_monthly']);
        $this->assertSame(300.0, $totals['commitments_monthly']);
        $this->assertSame(3700.0, $totals['disposable_monthly']);
    }

    public function test_commitments_are_never_subtracted_from_available_now(): void
    {
        $totals = (new AssessmentCalculator)->calculate(
            [
                $this->line('bank', FinancialKindRole::Asset, 10000, F::Once, C::Confirmed),
                $this->line('mortgage', FinancialKindRole::Commitment, 2000, F::Monthly, C::Confirmed),
            ],
            [],
            'EUR',
            CarbonImmutable::parse('2026-11-12'),
        );

        $this->assertSame(10000.0, $totals['available_now']);
    }

    public function test_an_override_replaces_available_now_and_keeps_the_computed_figure(): void
    {
        $totals = (new AssessmentCalculator)->calculate(
            [$this->line('bank', FinancialKindRole::Asset, 10000, F::Once, C::Confirmed)],
            [],
            'EUR',
            CarbonImmutable::parse('2026-11-12'),
            7500.0,
        );

        $this->assertSame(7500.0, $totals['available_now']);
        $this->assertSame(10000.0, $totals['computed_available_now']);
        $this->assertSame(7500.0, $totals['available_now_override']);
    }

    public function test_totals_are_broken_down_by_kind_and_by_type(): void
    {
        $totals = (new AssessmentCalculator)->calculate(
            $this->mockupLines(),
            ['BTC' => 60000.0],
            'EUR',
            CarbonImmutable::parse('2026-11-12'),
        );

        $this->assertSame(['role' => 'income', 'counted' => 10800.0, 'uncertain' => 0.0], $totals['by_kind']['income']);
        $this->assertSame(['role' => 'funding', 'counted' => 180000.0, 'uncertain' => 30000.0], $totals['by_kind']['funding']);
        $this->assertSame(['counted' => 9600.0, 'uncertain' => 0.0], $totals['by_type']['salary']);
        $this->assertSame(['counted' => 24000.0, 'uncertain' => 0.0], $totals['by_type']['crypto']);
        $this->assertSame(['counted' => 0.0, 'uncertain' => 30000.0], $totals['by_type']['family_gift']);
    }

    public function test_a_kind_the_admin_created_later_is_counted_by_its_role(): void
    {
        $totals = (new AssessmentCalculator)->calculate(
            [$this->line('insurance_payout', FinancialKindRole::Funding, 20000, F::Once, C::Confirmed, 'EUR', null, 'insurance_payouts')],
            [],
            'EUR',
            CarbonImmutable::parse('2026-11-12'),
        );

        $this->assertSame(20000.0, $totals['funding_total']);
        $this->assertSame(20000.0, $totals['available_now']);
        $this->assertSame('funding', $totals['by_kind']['insurance_payouts']['role']);
    }

    public function test_a_missing_rate_is_an_error_not_a_silent_zero(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('BTC');

        (new AssessmentCalculator)->calculate(
            [$this->line('crypto', FinancialKindRole::Asset, 1, F::Once, C::Confirmed, 'BTC')],
            [],
            'EUR',
            CarbonImmutable::parse('2026-11-12'),
        );
    }

    public function test_it_does_not_modify_the_dates_it_is_given(): void
    {
        $asOf = Carbon::parse('2026-11-12 15:30:00');
        $from = Carbon::parse('2026-11-10 09:00:00');

        (new AssessmentCalculator)->calculate(
            [new AssessmentLineInput('bank', 'saving_asset', FinancialKindRole::Asset, 100.0, 'EUR', F::Once, C::Confirmed, $from)],
            [],
            'EUR',
            $asOf,
        );

        $this->assertSame('2026-11-12 15:30:00', $asOf->toDateTimeString());
        $this->assertSame('2026-11-10 09:00:00', $from->toDateTimeString());
    }

    public function test_an_empty_assessment_is_all_zeros(): void
    {
        $totals = (new AssessmentCalculator)->calculate([], [], 'EUR', CarbonImmutable::parse('2026-11-12'));

        $this->assertSame(0.0, $totals['available_now']);
        $this->assertSame(0.0, $totals['disposable_monthly']);
        $this->assertSame([], $totals['by_kind']);
    }
}
