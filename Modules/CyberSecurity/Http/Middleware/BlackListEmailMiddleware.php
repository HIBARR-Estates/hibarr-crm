<?php

namespace Modules\CyberSecurity\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Modules\CyberSecurity\Entities\BlacklistEmail;

class BlackListEmailMiddleware
{

    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next)
    {

        $email = $request->email;

        if (!$email && auth()->check()) {
            $email = auth()->user()->email;
        }

        if (auth()->check() && BlacklistEmail::where('email', $email)->orWhere('email', $this->geyEmailDomain($email))->exists()) {
            abort(403, __('cybersecurity::messages.blacklistEmail'));
        }

        return $next($request);
    }

    private function geyEmailDomain($email)
    {
        return '@'. str($email)->after('@')->__toString();
    }

}
