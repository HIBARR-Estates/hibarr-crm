<?php

namespace Tests\Feature\FinancialAssessment;

use App\Services\FinancialAssessment\Rates\CryptoRateService;
use App\Services\FinancialAssessment\Rates\CurrencyRateResolver;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Tests\FinancialAssessmentTestCase;

class CurrencyRatesTest extends FinancialAssessmentTestCase
{
    private function coingecko(?string $key = 'test-key'): void
    {
        Config::set('services.crypto_rates', [
            'provider' => 'coingecko',
            'coingecko' => ['api_key' => $key, 'base_url' => 'https://api.coingecko.test/v3'],
            'cache_seconds' => 120,
        ]);
    }

    public function test_all_tickers_are_priced_in_one_batched_request_and_then_served_from_cache(): void
    {
        $this->coingecko();
        Http::fake(['api.coingecko.test/*' => Http::response([
            'bitcoin' => ['eur' => 60000],
            'ethereum' => ['eur' => 2500.5],
        ])]);
        $service = app(CryptoRateService::class);

        $first = $service->quotes($this->companyId, ['btc', 'ETH'], 'EUR');
        $second = $service->quotes($this->companyId, ['BTC', 'ETH'], 'EUR');

        $this->assertSame(60000.0, $first['BTC']->rate);
        $this->assertSame(2500.5, $first['ETH']->rate);
        $this->assertSame('coingecko', $first['BTC']->source);
        $this->assertNotNull($first['BTC']->fetchedAt);
        $this->assertSame(60000.0, $second['BTC']->rate);
        Http::assertSentCount(1);
        Http::assertSent(fn ($r) => $r['ids'] === 'bitcoin,ethereum' && $r['vs_currencies'] === 'eur');
    }

    public function test_a_fiat_the_provider_cannot_quote_is_converted_through_usd_and_the_ecb_rate(): void
    {
        $this->coingecko();
        Http::fake(function ($request) {
            if (str_contains($request->url(), 'coingecko')) {
                return $request['vs_currencies'] === 'usd'
                    ? Http::response(['bitcoin' => ['usd' => 70000]])
                    : Http::response([]);
            }

            return Http::response(['amount' => 1, 'base' => 'USD', 'date' => '2026-11-12', 'rates' => ['CHF' => 0.9]]);
        });

        $quote = app(CryptoRateService::class)->quotes($this->companyId, ['BTC'], 'CHF')['BTC'];

        $this->assertEqualsWithDelta(63000.0, $quote->rate, 0.001);
        $this->assertSame('coingecko+ecb', $quote->source);
    }

    public function test_without_an_api_key_no_request_is_made_and_nothing_is_priced(): void
    {
        $this->coingecko(null);
        Http::fake();

        $service = app(CryptoRateService::class);

        $this->assertFalse($service->isConfigured());
        $this->assertNull($service->quotes($this->companyId, ['BTC'], 'EUR')['BTC']);
        Http::assertNothingSent();
    }

    public function test_a_provider_failure_yields_no_rate_instead_of_an_exception(): void
    {
        $this->coingecko();
        Http::fake(['api.coingecko.test/*' => Http::response('rate limited', 429)]);

        $this->assertNull(app(CryptoRateService::class)->quotes($this->companyId, ['BTC'], 'EUR')['BTC']);
    }

    public function test_an_unknown_or_disabled_ticker_is_never_sent_to_the_provider(): void
    {
        $this->coingecko();
        DB::table('financial_crypto_assets')->where('ticker', 'ETH')->update(['is_active' => false]);
        Http::fake(['api.coingecko.test/*' => Http::response(['bitcoin' => ['eur' => 60000]])]);

        $quotes = app(CryptoRateService::class)->quotes($this->companyId, ['BTC', 'ETH', 'DOGE'], 'EUR');

        $this->assertNotNull($quotes['BTC']);
        $this->assertNull($quotes['ETH']);
        $this->assertNull($quotes['DOGE']);
        Http::assertSent(fn ($r) => $r['ids'] === 'bitcoin');
    }

    public function test_coinmarketcap_is_queried_by_ticker_and_both_response_shapes_are_read(): void
    {
        Config::set('services.crypto_rates', [
            'provider' => 'coinmarketcap',
            'coinmarketcap' => ['api_key' => 'cmc-key', 'base_url' => 'https://cmc.test/v1'],
            'cache_seconds' => 120,
        ]);
        Http::fake(['cmc.test/*' => Http::response(['data' => [
            'BTC' => ['quote' => ['EUR' => ['price' => 60000]]],
            'ETH' => [['quote' => ['EUR' => ['price' => 2500]]]],
        ]])]);

        $quotes = app(CryptoRateService::class)->quotes($this->companyId, ['BTC', 'ETH'], 'EUR');

        $this->assertSame(60000.0, $quotes['BTC']->rate);
        $this->assertSame(2500.0, $quotes['ETH']->rate);
        $this->assertSame('coinmarketcap', $quotes['BTC']->source);
        Http::assertSent(fn ($r) => $r->hasHeader('X-CMC_PRO_API_KEY', 'cmc-key') && $r['symbol'] === 'BTC,ETH' && $r['convert'] === 'EUR');
    }

    public function test_the_resolver_picks_the_right_source_per_currency_and_reports_what_is_missing(): void
    {
        $this->coingecko();
        Http::fake(function ($request) {
            if (str_contains($request->url(), 'coingecko')) {
                return Http::response(['bitcoin' => ['eur' => 60000]]);
            }

            return str_contains($request->url(), 'from=GBP')
                ? Http::response(['amount' => 1, 'base' => 'GBP', 'date' => '2026-11-12', 'rates' => ['EUR' => 1.15]])
                : Http::response('nope', 500);
        });

        $result = app(CurrencyRateResolver::class)->resolve($this->companyId, ['EUR', 'GBP', 'BTC', 'JPY', 'SOL'], 'EUR');

        $this->assertSame(1.0, $result['rates']['EUR']->rate);
        $this->assertSame('base', $result['rates']['EUR']->source);
        $this->assertSame(1.15, $result['rates']['GBP']->rate);
        $this->assertSame('ecb', $result['rates']['GBP']->source);
        $this->assertSame('2026-11-12', $result['rates']['GBP']->fetchedAt);
        $this->assertSame(60000.0, $result['rates']['BTC']->rate);
        $this->assertEqualsCanonicalizing(['JPY', 'SOL'], $result['missing']);
    }

    public function test_a_manual_rate_wins_over_a_fetched_one_and_is_labelled_manual(): void
    {
        $this->coingecko();
        Http::fake();

        $result = app(CurrencyRateResolver::class)->resolve($this->companyId, ['BTC'], 'EUR', ['btc' => '55000', 'JPY' => 'abc']);

        $this->assertSame(55000.0, $result['rates']['BTC']->rate);
        $this->assertSame('manual', $result['rates']['BTC']->source);
        $this->assertSame([], $result['missing']);
        Http::assertNothingSent();
    }
}
