<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Live reference FX rates.
 *
 * Frankfurter publishes the ECB's daily reference rates: free, open source, and
 * — the actual requirement — usable without an API key or account, so nothing
 * has to be provisioned per environment. Deliberately not a crypto ticker
 * (CoinGecko et al); these are fiat sales figures.
 *
 * Cached once for everyone rather than once per user, so a blocked third-party
 * request can never take a page down. Shared by the deal value modal (via
 * ExchangeRateController) and deal payment request conversion.
 */
class ExchangeRateService
{
    /** ECB publishes once per working day, so anything shorter just adds load. */
    private const CACHE_TTL_SECONDS = 43200; // 12 hours

    /**
     * How many units of $to one unit of $from buys, or null when no live rate
     * is available.
     */
    public function rate(string $from, string $to): ?float
    {
        $from = strtoupper($from);
        $to = strtoupper($to);

        if ($from === $to) {
            return 1.0;
        }

        $cacheKey = "fx_rate_{$from}_{$to}";

        $rate = Cache::remember($cacheKey, self::CACHE_TTL_SECONDS, fn () => $this->fetchRate($from, $to));

        if ($rate === null) {
            // Cache::remember stores the null too; drop it so a transient
            // outage isn't remembered for the next 12 hours.
            Cache::forget($cacheKey);
        }

        return $rate;
    }

    /**
     * The rate together with the date the ECB published it, which can be
     * older than today (weekends, holidays, before the daily publication).
     *
     * @return array{rate: float, date: string|null}|null date as Y-m-d
     */
    public function quote(string $from, string $to): ?array
    {
        $from = strtoupper($from);
        $to = strtoupper($to);

        if ($from === $to) {
            return ['rate' => 1.0, 'date' => now()->toDateString()];
        }

        $cacheKey = "fx_quote_{$from}_{$to}";

        $quote = Cache::remember($cacheKey, self::CACHE_TTL_SECONDS, fn () => $this->fetchQuote($from, $to));

        if ($quote === null) {
            Cache::forget($cacheKey);
        }

        return $quote;
    }

    private function fetchRate(string $from, string $to): ?float
    {
        return $this->fetchQuote($from, $to)['rate'] ?? null;
    }

    /**
     * @return array{rate: float, date: string|null}|null
     */
    private function fetchQuote(string $from, string $to): ?array
    {
        try {
            $response = Http::timeout(5)
                ->get('https://api.frankfurter.app/latest', [
                    'from' => $from,
                    'to' => $to,
                ]);

            if (! $response->successful()) {
                return null;
            }

            $rate = $response->json("rates.{$to}");
            if (! is_numeric($rate) || (float) $rate <= 0) {
                return null;
            }

            // The publication date is printed next to the rate, so when the
            // response has none it stays unknown rather than becoming today.
            $date = $response->json('date');

            return [
                'rate' => (float) $rate,
                'date' => is_string($date) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) ? $date : null,
            ];
        } catch (\Throwable $e) {
            Log::warning('Exchange rate lookup failed', [
                'from' => $from,
                'to' => $to,
                'message' => $e->getMessage(),
            ]);

            return null;
        }
    }
}
