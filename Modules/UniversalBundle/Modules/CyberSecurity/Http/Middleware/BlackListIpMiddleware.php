<?php

namespace Modules\CyberSecurity\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Modules\CyberSecurity\Entities\BlacklistIp;

class BlackListIpMiddleware
{

    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next)
    {

        if (BlacklistIp::where('ip_address', $request->ip())->exists()) {
            abort(403, __('cybersecurity::messages.blacklistIp'));
        }

        return $next($request);
    }

}
