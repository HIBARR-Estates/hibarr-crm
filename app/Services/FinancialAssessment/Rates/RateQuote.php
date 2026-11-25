<?php

namespace App\Services\FinancialAssessment\Rates;

/** A conversion rate (units of the target currency per one unit) and where it came from. */
final class RateQuote
{
    public function __construct(
        public readonly float $rate,
        public readonly string $source,
        public readonly ?string $fetchedAt = null,
    ) {}

    /** @return array{rate: float, source: string, fetched_at: string|null} */
    public function toArray(): array
    {
        return ['rate' => $this->rate, 'source' => $this->source, 'fetched_at' => $this->fetchedAt];
    }
}
