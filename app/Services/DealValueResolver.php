<?php

namespace App\Services;

use App\Models\Deal;

class DealValueResolver
{
    public const SOURCE_MANUAL = 'manual';
    public const SOURCE_CALCULATED = 'calculated';

    /**
     * Resolve and persist canonical deal value based on selected source.
     *
     * Silent skip when commission-locked: callers still guard first, but a
     * missed check (name/stage save that always recalculates) must not throw
     * and must not rewrite the value commission was already calculated against.
     *
     * @param Deal $deal
     * @param float|null $manualValue
     * @param string|null $source
     */
    public function resolveAndPersist(Deal $deal, ?float $manualValue = null, ?string $source = null): Deal
    {
        if ($deal->isCommissionLocked()) {
            return $deal;
        }

        $normalizedSource = $this->normalizeSource($source ?? $deal->value_source);

        $manual = $manualValue;

        if ($manual === null) {
            if ($deal->manual_value !== null) {
                $manual = (float) $deal->manual_value;
            } else {
                $manual = (float) ($deal->value ?? 0);
            }
        }

        // Written before the breakdown is taken: it reads value_source and
        // manual_value off the model to decide which base the discount and
        // deduction come off, so those have to be the incoming values, not the
        // stored ones.
        $deal->manual_value = round($manual, 2);
        $deal->value_source = $normalizedSource;

        $breakdown = $this->getBreakdown($deal);

        $deal->calculated_value = $breakdown['calculated_value'];
        $deal->value = $breakdown['computed_value'];

        $deal->save();

        return $deal;
    }

    public function normalizeSource(?string $source): string
    {
        $source = strtolower((string) $source);

        return in_array($source, [self::SOURCE_MANUAL, self::SOURCE_CALCULATED], true)
            ? $source
            : self::SOURCE_CALCULATED;
    }

    public function calculateDealValue(Deal $deal): float
    {
        $breakdown = $this->getBreakdown($deal);

        return (float) $breakdown['calculated_value'];
    }

    public function getBreakdown(Deal $deal): array
    {
        $productsTotal = (float) $deal->products()->sum('products.price');
        $packagesTotal = (float) $deal->packages()->sum('packages.value');
        $grossTotal = $productsTotal + $packagesTotal;

        // Offer discounts are derived from the deal's products, so they only
        // make sense against the figure those products add up to. A manual
        // value is a number someone typed with the products already in mind —
        // subtracting offers from it again would double-count them.
        $offerDiscount = (float) $deal->offerApplications()->sum('discount_amount');
        $manualValue = $deal->manual_value !== null ? round((float) $deal->manual_value, 2) : null;
        $source = $this->normalizeSource($deal->value_source);

        $calculated = $this->applyAdjustments($deal, max(0, $grossTotal - $offerDiscount));
        $manual = $this->applyAdjustments($deal, (float) ($manualValue ?? 0));

        // The discount and the deduction apply to whichever figure the deal is
        // actually priced on, so a percentage discount on a manual deal comes
        // off the manual value rather than off components it never used.
        $active = $source === self::SOURCE_MANUAL ? $manual : $calculated;
        $activeBase = $source === self::SOURCE_MANUAL ? (float) ($manualValue ?? 0) : $grossTotal;
        $activeOfferDiscount = $source === self::SOURCE_MANUAL ? 0.0 : $offerDiscount;

        // deals.value as stored: the panel shows what the deal is actually
        // worth today, not what it would be worth after a recalculation that
        // has not happened yet. computed_value is that recalculation, and
        // resolveAndPersist() is what reconciles the two.
        $finalValue = round((float) ($deal->value ?? 0), 2);
        $rate = $this->exchangeRate($deal);

        return [
            'products_total' => round($productsTotal, 2),
            'packages_total' => round($packagesTotal, 2),
            'gross_total' => round($grossTotal, 2),
            // What the active source's adjustments are taken off.
            'base_value' => round($activeBase, 2),
            // Always the raw offer total, whichever source is active — the
            // value editor needs it to price the calculated option even while
            // the deal is still on manual. discount_total below is the figure
            // actually subtracted.
            'offer_discount_total' => round($offerDiscount, 2),
            'manual_discount_total' => round($active['discount'], 2),
            'discount_total' => round($activeOfferDiscount + $active['discount'], 2),
            'deduction_total' => round($active['deduction'], 2),
            'deduction_note' => $deal->deduction_note,
            'discount_type' => $deal->discount_type,
            'discount_value' => $deal->discount_value !== null ? round((float) $deal->discount_value, 2) : null,
            'calculated_value' => round($calculated['net'], 2),
            'manual_value' => $manualValue,
            'value_source' => $source,
            'computed_value' => round($active['net'], 2),
            'final_value' => $finalValue,
            // Every figure above is in the deal's own currency. This is the
            // same number expressed in the company's, and it is the one
            // commission and revenue are computed against.
            'final_value_company' => round($finalValue * $rate, 2),
            'currency' => $this->currencyContext($deal, $rate),
        ];
    }

    /**
     * Take the deal's manual discount and deduction off a base amount.
     *
     * Shared by both value sources so "10% off, minus a 500 deduction" means
     * the same arithmetic whether the deal is priced from its components or
     * from a number someone typed.
     *
     * @return array{discount: float, deduction: float, net: float}
     */
    public function applyAdjustments(Deal $deal, float $base): array
    {
        $discount = $this->manualDiscount($deal, $base);
        $deduction = min(max(0, (float) ($deal->deduction_amount ?? 0)), max(0, $base - $discount));

        // Cast explicitly: max(0, ...) hands back the int literal when it wins,
        // and these are money figures the callers type-hint as float.
        return [
            'discount' => (float) $discount,
            'deduction' => (float) $deduction,
            'net' => (float) max(0, $base - $discount - $deduction),
        ];
    }

    /**
     * The deal's manual discount as a money amount in the deal's own currency.
     *
     * A percentage discount is resolved against the base rather than stored as
     * an amount, so "10% off" stays 10% off after the deal is repriced.
     */
    public function manualDiscount(Deal $deal, float $base): float
    {
        $value = (float) ($deal->discount_value ?? 0);

        if ($value <= 0 || $base <= 0) {
            return 0.0;
        }

        return (float) ($deal->discount_type === 'percent'
            ? max(0, $base * min($value, 100) / 100)
            : max(0, min($value, $base)));
    }

    /**
     * Rate that converts one unit of the deal's currency into the company's.
     *
     * The snapshot on the deal is authoritative — same convention as
     * invoices/payments/expenses (`amount * exchange_rate`), and the same
     * expression MlmCommissionService::preview() already uses to compute the
     * value commission is paid on. An unset rate means "no conversion", which
     * is correct for the common case of a deal in the company's own currency.
     */
    public function exchangeRate(Deal $deal): float
    {
        $rate = (float) ($deal->exchange_rate ?? 0);

        return $rate > 0 ? $rate : 1.0;
    }

    /**
     * Which currency the breakdown's figures are in, which one the totals
     * convert to, and the rate between them.
     *
     * A deal with no currency of its own is already in company currency —
     * that's the majority of rows, since deals.currency_id is only populated
     * when someone sets it explicitly.
     *
     * @return array<string, mixed>
     */
    protected function currencyContext(Deal $deal, float $rate): array
    {
        $companyCurrency = $deal->company?->currency;
        $dealCurrency = $deal->currency ?? $companyCurrency;

        $dealCode = $dealCurrency?->currency_code;
        $companyCode = $companyCurrency?->currency_code;

        return [
            'deal_code' => $dealCode,
            'deal_symbol' => $dealCurrency?->currency_symbol ?: $dealCode,
            'company_code' => $companyCode,
            'company_symbol' => $companyCurrency?->currency_symbol ?: $companyCode,
            'exchange_rate' => $rate,
            // Only claim a conversion when there is genuinely one to show:
            // a 1.0 rate against the same currency is noise in the panel.
            'is_converted' => $rate !== 1.0
                || ($dealCode !== null && $companyCode !== null && $dealCode !== $companyCode),
        ];
    }
}
