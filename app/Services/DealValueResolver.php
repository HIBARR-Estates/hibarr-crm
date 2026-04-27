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
            : self::SOURCE_MANUAL;
    }

    public function calculateDealValue(Deal $deal): float
    {
        $productsTotal = (float) $deal->products()->sum('products.price');
        $discountTotal = (float) $deal->offerApplications()->sum('discount_amount');

        return max(0, $productsTotal - $discountTotal);
    }
}
