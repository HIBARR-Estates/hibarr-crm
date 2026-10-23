<?php

namespace Tests\Unit\Services\Suppression;

use App\Services\Suppression\SuppressionClient;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class SuppressionClientTest extends TestCase
{
    public function test_it_records_would_have_blocked_without_withholding_when_flag_is_off(): void
    {
        $this->configure();

        Http::fake([
            'https://ol.test/v1/suppression/check' => Http::response([
                'success' => true,
                'data' => [
                    'items' => [[
                        'email' => 'user@example.com',
                        'scope' => 'non_transactional',
                        'blocked' => false,
                        'wouldBlock' => true,
                        'suppression' => ['reason' => 'unsubscribed'],
                    ]],
                    'unavailable' => false,
                    'enforced' => false,
                ],
            ], 200),
        ]);

        $result = (new SuppressionClient)->checkEmail('user@example.com');

        $this->assertFalse($result->blocked);
        $this->assertTrue($result->wouldBlock);
        $this->assertFalse($result->unavailable);
        $this->assertSame('unsubscribed', $result->reason);
    }

    public function test_it_blocks_when_enforced_and_the_target_is_suppressed(): void
    {
        $this->configure();

        Http::fake([
            'https://ol.test/v1/suppression/check' => Http::response([
                'success' => true,
                'data' => [
                    'items' => [[
                        'email' => 'user@example.com',
                        'scope' => 'non_transactional',
                        'blocked' => true,
                        'wouldBlock' => true,
                        'suppression' => ['reason' => 'bounced'],
                    ]],
                    'unavailable' => false,
                    'enforced' => true,
                ],
            ], 200),
        ]);

        $result = (new SuppressionClient)->checkEmail('user@example.com');

        $this->assertTrue($result->blocked);
        $this->assertTrue($result->wouldBlock);
        $this->assertSame('bounced', $result->reason);
    }

    public function test_an_unreachable_check_holds_non_transactional_and_allows_transactional(): void
    {
        Config::set('services.ol.base_url', '');
        Config::set('services.ol.api_key', '');

        $client = new SuppressionClient;

        $nonTransactional = $client->checkEmail('user@example.com', SuppressionClient::SCOPE_NON_TRANSACTIONAL);
        $transactional = $client->checkEmail('user@example.com', SuppressionClient::SCOPE_TRANSACTIONAL);

        $this->assertTrue($nonTransactional->blocked);
        $this->assertTrue($nonTransactional->unavailable);

        $this->assertFalse($transactional->blocked);
        $this->assertTrue($transactional->unavailable);
    }

    private function configure(): void
    {
        Config::set('services.ol.base_url', 'https://ol.test/v1');
        Config::set('services.ol.api_key', 'test-key');
    }
}
