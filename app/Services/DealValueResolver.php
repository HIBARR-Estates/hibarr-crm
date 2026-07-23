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
     * @param Deal $deal
     * @param float|null $manualValue
     * @param string|null $source
     */
    public function resolveAndPersist(Deal $deal, ?float $manualValue = null, ?string $source = null): Deal
    {
        $normalizedSource = $this->normalizeSource($source ?? $deal->value_source);

        $manual = $manualValue;

        if ($manual === null) {
            if ($deal->manual_value !== null) {
                $manual = (float) $deal->manual_value;
            } else {
                $manual = (float) ($deal->value ?? 0);
            }
        }

        $calculated = $this->calculateDealValue($deal);

        $deal->manual_value = round($manual, 2);
        $deal->calculated_value = round($calculated, 2);
        $deal->value_source = $normalizedSource;
        $deal->value = $normalizedSource === self::SOURCE_CALCULATED
            ? $deal->calculated_value
            : $deal->manual_value;

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
        $discountTotal = (float) $deal->offerApplications()->sum('discount_amount');
        $calculatedValue = max(0, $grossTotal - $discountTotal);

        return [
            'products_total' => round($productsTotal, 2),
            'packages_total' => round($packagesTotal, 2),
            'gross_total' => round($grossTotal, 2),
            'discount_total' => round($discountTotal, 2),
            'calculated_value' => round($calculatedValue, 2),
            'manual_value' => $deal->manual_value !== null ? round((float) $deal->manual_value, 2) : null,
            'value_source' => $this->normalizeSource($deal->value_source),
            'final_value' => round((float) ($deal->value ?? 0), 2),
        ];
    }
}
