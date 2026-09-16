<?php

namespace App\Http\Middleware;

use Illuminate\Http\Middleware\TrustProxies as Middleware;

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

}
