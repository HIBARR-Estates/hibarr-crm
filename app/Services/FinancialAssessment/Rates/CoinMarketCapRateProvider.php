<?php

namespace App\Services\FinancialAssessment\Rates;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/** CoinMarketCap latest quotes, queried by ticker symbol. Needs an API key (env only). */
class CoinMarketCapRateProvider implements CryptoRateProvider
{
    public function __construct(
        private readonly ?string $apiKey,
        private readonly string $baseUrl,
    ) {}

    public function name(): string
    {
        return 'coinmarketcap';
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

        $currency = strtoupper($fiat);

        try {
            $response = Http::acceptJson()
                ->timeout(8)
                ->withHeaders(['X-CMC_PRO_API_KEY' => (string) $this->apiKey])
                ->get(rtrim($this->baseUrl, '/').'/cryptocurrency/quotes/latest', [
                    'symbol' => implode(',', array_unique(array_column($assets, 'ticker'))),
                    'convert' => $currency,
                ]);
        } catch (ConnectionException $e) {
            Log::warning('CoinMarketCap rate request failed', ['error' => $e->getMessage()]);

            return $result;
        }

        if (! $response->successful()) {
            Log::warning('CoinMarketCap rate request refused', ['status' => $response->status()]);

            return $result;
        }

        $data = (array) $response->json('data');

        foreach ($assets as $asset) {
            $entry = $data[$asset['ticker']] ?? null;

            // v1 answers with an object per symbol, v2 with a list of matches.
            if (is_array($entry) && array_is_list($entry)) {
                $entry = $entry[0] ?? null;
            }

            $price = is_array($entry) ? ($entry['quote'][$currency]['price'] ?? null) : null;
            $result[$asset['ticker']] = is_numeric($price) && (float) $price > 0 ? (float) $price : null;
        }

        return $result;
    }
}
