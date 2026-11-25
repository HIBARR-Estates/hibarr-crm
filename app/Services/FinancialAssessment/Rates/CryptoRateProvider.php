<?php

namespace App\Services\FinancialAssessment\Rates;

/** A source of live crypto prices in a fiat currency. */
interface CryptoRateProvider
{
    public function name(): string;

    public function isConfigured(): bool;

    /**
     * Price of each asset in one unit of $fiat. A ticker the provider could
     * not price is null; a transport or API failure yields null for all, never an exception.
     *
     * @param  list<array{ticker: string, provider_id: string}>  $assets
     * @return array<string, float|null> keyed by ticker
     */
    public function quotes(array $assets, string $fiat): array;
}
