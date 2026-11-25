<?php

namespace App\Services\FinancialAssessment;

use App\Enums\FinancialKindRole;
use App\Enums\FinancialLineCertainty;
use App\Enums\FinancialLineFrequency;
use Carbon\CarbonInterface;
use InvalidArgumentException;

/**
 * Pure calculation of an assessment's totals. No database, no clock, no
 * network: lines, rates and the as-of date go in, a frozen-ready array comes out.
 *
 * Rules (CALC_VERSION 1). Every line is first converted to the reporting
 * currency and rounded to cents, so what is shown adds up to what is totalled.
 *
 *  - Income: monthly equivalent (yearly / 12; one-off income is not recurring
 *    and is left out of the monthly figure). Confirmed and likely lines count;
 *    uncertain ones are reported separately and never summed in.
 *  - Commitment: monthly equivalent, every certainty counts (prudence: an
 *    uncertain obligation is still an obligation).
 *  - Asset and Funding: a stock of money, frequency is ignored.
 *      available_now       confirmed and available by the as-of date
 *      available_projected confirmed + likely, regardless of date
 *      uncertain_total     uncertain, never summed into either
 *  - disposable_monthly = income_monthly - commitments_monthly. Commitments
 *    are never subtracted from available_now.
 *  - An override replaces available_now; the computed figure is kept beside it.
 *
 * Bump CALC_VERSION when a rule changes, so frozen finals stay explainable.
 */
final class AssessmentCalculator
{
    public const CALC_VERSION = 1;

    /**
     * @param  list<AssessmentLineInput>  $lines
     * @param  array<string, float>  $rates  currency => units of $baseCurrency per one unit (base currency may be omitted)
     * @return array<string, mixed>
     */
    public function calculate(
        array $lines,
        array $rates,
        string $baseCurrency,
        CarbonInterface $asOf,
        ?float $availableNowOverride = null,
    ): array {
        $base = strtoupper($baseCurrency);

        $incomeMonthly = 0.0;
        $uncertainIncomeMonthly = 0.0;
        $commitmentsMonthly = 0.0;
        $assetsTotal = 0.0;
        $fundingTotal = 0.0;
        $availableNow = 0.0;
        $availableProjected = 0.0;
        $uncertainTotal = 0.0;
        $byKind = [];
        $byType = [];

        foreach ($lines as $line) {
            $converted = round($line->amount * $this->rateFor($line->currency, $base, $rates), 2);
            $counted = 0.0;
            $uncertain = 0.0;

            switch ($line->role) {
                case FinancialKindRole::Income:
                    $monthly = $this->monthlyEquivalent($converted, $line->frequency);
                    if ($monthly === null) {
                        break;
                    }
                    if ($line->certainty === FinancialLineCertainty::Uncertain) {
                        $uncertainIncomeMonthly += $monthly;
                        $uncertain = $monthly;
                    } else {
                        $incomeMonthly += $monthly;
                        $counted = $monthly;
                    }
                    break;

                case FinancialKindRole::Commitment:
                    $monthly = $this->monthlyEquivalent($converted, $line->frequency);
                    if ($monthly === null) {
                        break;
                    }
                    $commitmentsMonthly += $monthly;
                    $counted = $monthly;
                    break;

                case FinancialKindRole::Asset:
                case FinancialKindRole::Funding:
                    if ($line->certainty === FinancialLineCertainty::Uncertain) {
                        $uncertainTotal += $converted;
                        $uncertain = $converted;
                        break;
                    }

                    if ($line->role === FinancialKindRole::Asset) {
                        $assetsTotal += $converted;
                    } else {
                        $fundingTotal += $converted;
                    }
                    $availableProjected += $converted;
                    $counted = $converted;

                    $availableByNow = $line->availableFrom === null || $line->availableFrom->copy()->startOfDay()->lte($asOf->copy()->startOfDay());
                    if ($line->certainty === FinancialLineCertainty::Confirmed && $availableByNow) {
                        $availableNow += $converted;
                    }
                    break;
            }

            $byKind[$line->kindKey] ??= ['role' => $line->role->value, 'counted' => 0.0, 'uncertain' => 0.0];
            $byKind[$line->kindKey]['counted'] += $counted;
            $byKind[$line->kindKey]['uncertain'] += $uncertain;

            $byType[$line->typeKey] ??= ['counted' => 0.0, 'uncertain' => 0.0];
            $byType[$line->typeKey]['counted'] += $counted;
            $byType[$line->typeKey]['uncertain'] += $uncertain;
        }

        $computedAvailableNow = round($availableNow, 2);
        $effectiveAvailableNow = $availableNowOverride !== null
            ? round($availableNowOverride, 2)
            : $computedAvailableNow;

        return [
            'calc_version' => self::CALC_VERSION,
            'base_currency' => $base,
            'as_of' => $asOf->toDateString(),
            'income_monthly' => round($incomeMonthly, 2),
            'uncertain_income_monthly' => round($uncertainIncomeMonthly, 2),
            'commitments_monthly' => round($commitmentsMonthly, 2),
            'disposable_monthly' => round($incomeMonthly - $commitmentsMonthly, 2),
            'assets_total' => round($assetsTotal, 2),
            'funding_total' => round($fundingTotal, 2),
            'computed_available_now' => $computedAvailableNow,
            'available_now_override' => $availableNowOverride !== null ? round($availableNowOverride, 2) : null,
            'available_now' => $effectiveAvailableNow,
            'available_projected' => round($availableProjected, 2),
            'uncertain_total' => round($uncertainTotal, 2),
            'by_kind' => array_map(fn (array $row) => [
                'role' => $row['role'],
                'counted' => round($row['counted'], 2),
                'uncertain' => round($row['uncertain'], 2),
            ], $byKind),
            'by_type' => array_map(fn (array $row) => [
                'counted' => round($row['counted'], 2),
                'uncertain' => round($row['uncertain'], 2),
            ], $byType),
        ];
    }

    private function monthlyEquivalent(float $amount, FinancialLineFrequency $frequency): ?float
    {
        return match ($frequency) {
            FinancialLineFrequency::Monthly => $amount,
            FinancialLineFrequency::Yearly => round($amount / 12, 2),
            FinancialLineFrequency::Once => null,
        };
    }

    /** @param array<string, float> $rates */
    private function rateFor(string $currency, string $base, array $rates): float
    {
        $currency = strtoupper($currency);

        if ($currency === $base) {
            return 1.0;
        }

        $rate = $rates[$currency] ?? null;

        if ($rate === null || $rate <= 0) {
            throw new InvalidArgumentException("No exchange rate from {$currency} to {$base}.");
        }

        return $rate;
    }
}
