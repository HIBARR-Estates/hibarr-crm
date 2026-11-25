<?php

namespace App\Services\FinancialAssessment\Rates;

use App\Services\ExchangeRateService;

/**
 * Rates from every currency an assessment uses into its reporting currency.
 *
 * A currency that is one of the company's active crypto tickers is priced by
 * {@see CryptoRateService}; anything else is treated as fiat and priced from
 * the ECB feed via {@see ExchangeRateService}. A rate entered by hand wins and
 * is recorded as source "manual". Currencies that end up with no rate are
 * returned in `missing`, never defaulted: the caller must not finalise on a guess.
 */
class CurrencyRateResolver
{
    public function __construct(
        private readonly ExchangeRateService $fiatRates,
        private readonly CryptoRateService $cryptoRates,
    ) {}

    /**
     * @param  list<string>  $currencies  currencies used by the lines (the base may be included)
     * @param  array<string, float|int|string>  $manualRates  currency => units of $base per one unit
     * @return array{rates: array<string, RateQuote>, missing: list<string>}
     */
    public function resolve(int $companyId, array $currencies, string $base, array $manualRates = []): array
    {
        $base = strtoupper($base);
        $currencies = array_values(array_unique(array_map('strtoupper', $currencies)));
        $manual = [];
        foreach ($manualRates as $currency => $rate) {
            if (is_numeric($rate) && (float) $rate > 0) {
                $manual[strtoupper((string) $currency)] = (float) $rate;
            }
        }

        $rates = [];
        $missing = [];
        $now = now()->toIso8601String();

        $crypto = array_values(array_intersect($currencies, $this->cryptoRates->activeTickers($companyId)));
        $cryptoQuotes = array_diff($crypto, array_keys($manual)) === []
            ? []
            : $this->cryptoRates->quotes($companyId, array_values(array_diff($crypto, array_keys($manual))), $base);

        foreach ($currencies as $currency) {
            if ($currency === $base) {
                $rates[$currency] = new RateQuote(1.0, 'base');

                continue;
            }

            if (isset($manual[$currency])) {
                $rates[$currency] = new RateQuote($manual[$currency], 'manual', $now);

                continue;
            }

            if (in_array($currency, $crypto, true)) {
                $quote = $cryptoQuotes[$currency] ?? null;
            } else {
                $ecb = $this->fiatRates->quote($currency, $base);
                $quote = $ecb !== null ? new RateQuote($ecb['rate'], 'ecb', $ecb['date'] ?? $now) : null;
            }

            if ($quote === null) {
                $missing[] = $currency;

                continue;
            }

            $rates[$currency] = $quote;
        }

        return ['rates' => $rates, 'missing' => $missing];
    }
}
