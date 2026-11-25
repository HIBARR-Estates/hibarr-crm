<?php

namespace App\Services\FinancialAssessment\Rates;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * CoinGecko "simple price". The free Demo plan needs an API key, sent in
 * the x-cg-demo-api-key header; it is read from env, never stored in the repo.
 */
class CoinGeckoRateProvider implements CryptoRateProvider
{
    public function __construct(
        private readonly ?string $apiKey,
        private readonly string $baseUrl,
    ) {}

    public function name(): string
    {
        return 'coingecko';
    }

    public function isConfigured(): bool
    {
        return filled($this->apiKey);
    }

    public function quotes(array $assets, string $fiat): array
    {
        $result = array_fill_keys(array_column($assets, 'ticker'), null);

        if ($assets === [] || ! $this->isConfigured()) {
            return $result;
        }

        $currency = strtolower($fiat);

        try {
            $response = Http::acceptJson()
                ->timeout(8)
                ->withHeaders(['x-cg-demo-api-key' => (string) $this->apiKey])
                ->get(rtrim($this->baseUrl, '/').'/simple/price', [
                    'ids' => implode(',', array_unique(array_column($assets, 'provider_id'))),
                    'vs_currencies' => $currency,
                ]);
        } catch (ConnectionException $e) {
            Log::warning('CoinGecko rate request failed', ['error' => $e->getMessage()]);

            return $result;
        }

        if (! $response->successful()) {
            Log::warning('CoinGecko rate request refused', ['status' => $response->status()]);

            return $result;
        }

        $data = (array) $response->json();

        foreach ($assets as $asset) {
            $price = $data[$asset['provider_id']][$currency] ?? null;
            $result[$asset['ticker']] = is_numeric($price) && (float) $price > 0 ? (float) $price : null;
        }

        return $result;
    }
}
