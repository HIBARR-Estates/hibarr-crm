<?php

namespace Tests\Unit\Http;

use App\Http\Middleware\TrustProxies;
use Illuminate\Http\Request;
use Tests\TestCase;

class TrustProxiesTest extends TestCase
{
    public function test_forwarded_for_from_a_public_address_is_ignored_by_default(): void
    {
        $this->assertSame('198.51.100.7', $this->clientIp('198.51.100.7', null));
    }

    public function test_local_reverse_proxy_is_trusted_by_default(): void
    {
        $this->assertSame('203.0.113.9', $this->clientIp('127.0.0.1', null));
        $this->assertSame('203.0.113.9', $this->clientIp('10.1.2.3', ''));
    }

    public function test_configured_proxy_list_replaces_the_default(): void
    {
        $this->assertSame('203.0.113.9', $this->clientIp('198.51.100.7', '198.51.100.0/24, 192.0.2.1'));
        $this->assertSame('127.0.0.1', $this->clientIp('127.0.0.1', '198.51.100.0/24'));
    }

    public function test_wildcard_trusts_any_hop(): void
    {
        $this->assertSame('203.0.113.9', $this->clientIp('198.51.100.7', '*'));
    }

    private function clientIp(string $remoteAddr, ?string $trustedProxies): string
    {
        config(['app.trusted_proxies' => $trustedProxies]);

        $request = Request::create('/', 'GET', [], [], [], [
            'REMOTE_ADDR' => $remoteAddr,
            'HTTP_X_FORWARDED_FOR' => '203.0.113.9',
        ]);

        return (new TrustProxies())->handle($request, fn (Request $request) => response($request->ip()))->getContent();
    }
}
