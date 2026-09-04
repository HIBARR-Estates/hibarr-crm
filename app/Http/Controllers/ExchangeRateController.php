<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Live reference FX rates for the deal value modal.
 *
 * Frankfurter publishes the ECB's daily reference rates: free, open source, and
 * — the actual requirement — usable without an API key or account, so nothing
 * has to be provisioned per environment. Deliberately not a crypto ticker
 * (CoinGecko et al); these are fiat sales figures.
 *
 * Proxied rather than called from the browser so the rate is cached once for
 * everyone instead of once per user per modal open, and so a blocked
 * third-party request can never break the page. The rate is only ever a
 * *suggestion*: the deal snapshots whatever rate is saved, and the field stays
 * editable, so a failure here degrades to "type it yourself" rather than an error.
 */
class ExchangeRateController extends Controller
{
    /** ECB publishes once per working day, so anything shorter just adds load. */
    private const CACHE_TTL_SECONDS = 43200; // 12 hours

    public function show(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'from' => 'required|string|size:3|alpha',
            'to' => 'required|string|size:3|alpha',
        ]);

        $from = strtoupper($validated['from']);
        $to = strtoupper($validated['to']);

        if ($from === $to) {
            return response()->json(['rate' => 1.0, 'date' => null, 'source' => 'identity']);
        }

        $rate = Cache::remember(
            "fx_rate_{$from}_{$to}",
            self::CACHE_TTL_SECONDS,
            fn () => $this->fetchRate($from, $to)
        );

        if ($rate === null) {
            // Cache::remember stores the null too; drop it so a transient
            // outage isn't remembered for the next 12 hours.
            Cache::forget("fx_rate_{$from}_{$to}");

            return response()->json([
                'rate' => null,
                'message' => 'Live rate unavailable — enter the rate manually.',
            ], 200);
        }

        return response()->json(['rate' => $rate, 'source' => 'frankfurter']);
    }

    private function fetchRate(string $from, string $to): ?float
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

            return is_numeric($rate) && (float) $rate > 0 ? (float) $rate : null;
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
