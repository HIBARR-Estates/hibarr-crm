<?php

namespace Modules\CyberSecurity\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Modules\CyberSecurity\Entities\LoginExpiry;

class LoginExpiryMiddleware
{

    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next)
    {
        if (auth()->check()) {

            $loginExpiry = LoginExpiry::where('user_id', auth()->user()->id)->first();

            if ($loginExpiry && $loginExpiry->expiry_date->isPast()) {
                auth()->logout();
                return redirect()->route('login')->with('message', __('cybersecurity::messages.loginExpiry'));
            }
        }

        return $next($request);
    }

}
