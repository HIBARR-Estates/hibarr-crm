<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Middleware\TrustProxies as Middleware;
use Illuminate\Http\Request;

class TrustProxies extends Middleware
{

    /**
     * Trusted when TRUSTED_PROXIES is unset: loopback and private networks,
     * i.e. a reverse proxy on the same host or the internal network.
     */
    private const DEFAULT_PROXIES = [
        '127.0.0.1',
        '::1',
        '10.0.0.0/8',
        '172.16.0.0/12',
        '192.168.0.0/16',
        'fc00::/7',
    ];

    /**
     * Only these hops may set X-Forwarded-For/-Proto/-Host. Set TRUSTED_PROXIES
     * to the load balancer / CDN ranges in front of the app, or "*" only when
     * the app can't be reached except through that proxy.
     *
     * @return array<int, string>|string
     */
    protected function proxies()
    {
        $configured = trim((string) config('app.trusted_proxies'));

        if ($configured === '') {
            return self::DEFAULT_PROXIES;
        }

        if ($configured === '*' || $configured === '**') {
            return $configured;
        }

        return array_values(array_filter(array_map('trim', explode(',', $configured))));
    }

    /**
     * The hop in front of nginx can report the connection as HTTP even when the
     * browser loaded the page over HTTPS. route() follows the configured scheme,
     * but url()->full() (what the datatables ajax URL is) follows the request.
     * Those have to agree, or the browser blocks the data request as mixed content.
     */
    public function handle(Request $request, Closure $next)
    {
        $request::setTrustedProxies([], $this->getTrustedHeaderNames());

        $this->setTrustedProxyIpAddresses($request);

        if ($this->shouldForceHttps($request)) {
            $request->headers->set('X-Forwarded-Proto', 'https');
            $request->server->set('HTTPS', 'on');
            // The container listens on 80. Leaving that port in place after the
            // scheme flip makes every URL https://host:80, which nothing serves.
            $this->dropInternalHttpPort($request);
        }

        return $next($request);
    }

    private function dropInternalHttpPort(Request $request): void
    {
        $forwardedPort = $request->headers->get('X-Forwarded-Port');

        if ($forwardedPort === null || (int) $forwardedPort === 80) {
            $request->headers->set('X-Forwarded-Port', '443');
        }

        foreach (['Host', 'X-Forwarded-Host'] as $header) {
            $value = $request->headers->get($header);

            if (is_string($value) && str_ends_with($value, ':80')) {
                $request->headers->set($header, substr($value, 0, -3));
            }
        }

        if ((int) $request->server->get('SERVER_PORT') === 80) {
            $request->server->set('SERVER_PORT', '443');
        }
    }

    private function shouldForceHttps(Request $request): bool
    {
        if (config('app.redirect_https') || str_starts_with((string) config('app.url'), 'https://')) {
            return true;
        }

        $visitor = json_decode((string) $request->headers->get('CF-Visitor'), true);

        return is_array($visitor) && ($visitor['scheme'] ?? null) === 'https';
    }

}
