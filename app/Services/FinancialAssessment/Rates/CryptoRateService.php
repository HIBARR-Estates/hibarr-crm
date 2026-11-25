<?php

namespace App\Services\FinancialAssessment\Rates;

use App\Models\FinancialCryptoAsset;
use App\Services\ExchangeRateService;
use Illuminate\Support\Facades\Cache;

/**
 * Live crypto -> fiat rates for a company's configured crypto assets.
 *
 * One batched provider call per fiat currency covers every ticker that is not
 * already cached; rates are cached for minutes (crypto moves), and what an
 * assessment finally uses is frozen by the caller at finalise. A provider that
 * cannot price the reporting currency is retried in USD and converted through
 * the ECB rate, so any fiat the ECB feed knows works.
 */
class CryptoRateService
{
    private const FALLBACK_FIAT = 'USD';

    public function __construct(private readonly ExchangeRateService $fiatRates) {}

    public function provider(): ?CryptoRateProvider
    {
        $config = (array) config('services.crypto_rates');

        return match ($config['provider'] ?? 'coingecko') {
            'coinmarketcap' => new CoinMarketCapRateProvider(
                $config['coinmarketcap']['api_key'] ?? null,
                $config['coinmarketcap']['base_url'] ?? 'https://pro-api.coinmarketcap.com/v1',
            ),
            'coingecko' => new CoinGeckoRateProvider(
                $config['coingecko']['api_key'] ?? null,
                $config['coingecko']['base_url'] ?? 'https://api.coingecko.com/api/v3',
            ),
            default => null,
        };
    }

    /** True when a provider is chosen and has its API key. */
    public function isConfigured(): bool
    {
        return (bool) $this->provider()?->isConfigured();
    }

    /** @return list<string> upper-case tickers the company has switched on */
    public function activeTickers(int $companyId): array
    {
        return FinancialCryptoAsset::withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->where('is_active', true)
            ->pluck('ticker')
            ->map(fn ($ticker) => strtoupper((string) $ticker))
            ->all();
    }

    /**
     * @param  list<string>  $tickers
     * @return array<string, RateQuote|null> keyed by upper-case ticker; null = no rate available
     */
    public function quotes(int $companyId, array $tickers, string $fiat): array
    {
        $fiat = strtoupper($fiat);
        $tickers = array_values(array_unique(array_map('strtoupper', $tickers)));
        $result = array_fill_keys($tickers, null);

        $provider = $this->provider();
        if ($tickers === [] || $provider === null || ! $provider->isConfigured()) {
            return $result;
        }

        $assets = FinancialCryptoAsset::withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->where('is_active', true)
            ->whereIn('ticker', $tickers)
            ->get(['ticker', 'provider_id'])
            ->map(fn ($asset) => ['ticker' => strtoupper($asset->ticker), 'provider_id' => $asset->provider_id])
            ->all();

        $ttl = max(30, (int) config('services.crypto_rates.cache_seconds', 300));
        $misses = [];

        foreach ($assets as $asset) {
            $cached = Cache::get($this->cacheKey($provider, $asset['ticker'], $fiat));
            if (is_array($cached) && isset($cached['rate'])) {
                $result[$asset['ticker']] = new RateQuote((float) $cached['rate'], $cached['source'], $cached['fetched_at'] ?? null);
            } else {
                $misses[] = $asset;
            }
        }

        if ($misses === []) {
            return $result;
        }

        $fetchedAt = now()->toIso8601String();
        $direct = $provider->quotes($misses, $fiat);
        $unpriced = [];

        foreach ($misses as $asset) {
            $price = $direct[$asset['ticker']] ?? null;
            if ($price === null) {
                $unpriced[] = $asset;

                continue;
            }
            $result[$asset['ticker']] = $this->remember($provider, $asset['ticker'], $fiat, new RateQuote($price, $provider->name(), $fetchedAt), $ttl);
        }

        if ($unpriced !== [] && $fiat !== self::FALLBACK_FIAT) {
            $usdToFiat = $this->fiatRates->rate(self::FALLBACK_FIAT, $fiat);
            $inUsd = $usdToFiat !== null ? $provider->quotes($unpriced, self::FALLBACK_FIAT) : [];

            foreach ($unpriced as $asset) {
                $usd = $inUsd[$asset['ticker']] ?? null;
                if ($usd !== null && $usdToFiat !== null) {
                    $result[$asset['ticker']] = $this->remember(
                        $provider,
                        $asset['ticker'],
                        $fiat,
                        new RateQuote($usd * $usdToFiat, $provider->name().'+ecb', $fetchedAt),
                        $ttl,
                    );
                }
            }
        }

        return $result;
    }

    private function remember(CryptoRateProvider $provider, string $ticker, string $fiat, RateQuote $quote, int $ttl): RateQuote
    {
        Cache::put($this->cacheKey($provider, $ticker, $fiat), $quote->toArray(), $ttl);

        return $quote;
    }

    private function cacheKey(CryptoRateProvider $provider, string $ticker, string $fiat): string
    {
        return "financial_crypto_rate:{$provider->name()}:{$ticker}:{$fiat}";
    }
}
