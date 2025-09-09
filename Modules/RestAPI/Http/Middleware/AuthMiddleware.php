<?php

namespace Modules\RestAPI\Http\Middleware;

use Closure;
use Froiden\RestAPI\Exceptions\UnauthorizedException;

class AuthMiddleware
{
    public function handle($request, Closure $next)
    {

        // Do not apply this middleware to OPTIONS request
        if ($request->getMethod() !== 'OPTIONS') {
            $user = auth()->user();

            if (!$user) {
                throw new UnauthorizedException('User not found auth', null, 403, 403, 2006);
            }

            if ($user->status == 'inactive') {
                $user->currentAccessToken()->delete();
                throw new UnauthorizedException('User account disabled', null, 403, 403, 2015);
            }
        }

        return $next($request);
    }
}
