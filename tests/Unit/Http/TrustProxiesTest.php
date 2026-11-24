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

    public function test_https_app_url_wins_over_a_proxy_that_says_http(): void
    {
        config([
            'app.url' => 'https://preview-crm.hibarr.org',
            'app.redirect_https' => false,
        ]);

        $this->assertSame(
            'https://preview-crm.hibarr.org/account/employees',
            $this->requestUrl('http', null)
        );
    }

    public function test_local_http_app_stays_http(): void
    {
        config([
            'app.url' => 'http://hibarr-crm.test',
            'app.redirect_https' => false,
        ]);

        $this->assertSame(
            'http://preview-crm.hibarr.org/account/employees',
            $this->requestUrl('http', null)
        );
    }

    public function test_https_urls_omit_the_container_port(): void
    {
        config([
            'app.url' => 'https://preview-crm.hibarr.org',
            'app.redirect_https' => false,
        ]);

        $request = Request::create('http://preview-crm.hibarr.org/account/employees', 'GET', [], [], [], [
            'REMOTE_ADDR' => '127.0.0.1',
            'HTTP_HOST' => 'preview-crm.hibarr.org:80',
            'HTTP_X_FORWARDED_PROTO' => 'http',
            'HTTP_X_FORWARDED_PORT' => '80',
            'SERVER_PORT' => '80',
        ]);

        $url = '';
        (new TrustProxies())->handle($request, function (Request $request) use (&$url) {
            $url = $request->url();

            return response('ok');
        });

        $this->assertSame('https://preview-crm.hibarr.org/account/employees', $url);
    }

    public function test_cloudflare_visitor_scheme_marks_the_request_https(): void
    {
        config([
            'app.url' => 'http://localhost:8080',
            'app.redirect_https' => false,
        ]);

        $this->assertSame(
            'https://preview-crm.hibarr.org/account/employees',
            $this->requestUrl('http', '{"scheme":"https"}')
        );
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

    private function requestUrl(string $forwardedProto, ?string $cfVisitor): string
    {
        $server = [
            'REMOTE_ADDR' => '127.0.0.1',
            'HTTP_HOST' => 'preview-crm.hibarr.org',
            'HTTP_X_FORWARDED_PROTO' => $forwardedProto,
        ];

        if ($cfVisitor !== null) {
            $server['HTTP_CF_VISITOR'] = $cfVisitor;
        }

        $request = Request::create('http://preview-crm.hibarr.org/account/employees', 'GET', [], [], [], $server);

        $url = '';
        (new TrustProxies())->handle($request, function (Request $request) use (&$url) {
            $url = $request->url();

            return response('ok');
        });

        return $url;
    }
}
