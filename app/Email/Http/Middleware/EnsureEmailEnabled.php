<?php

namespace App\Email\Http\Middleware;

use App\Email\EmailFeature;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * With crm.email off the Email endpoints do not exist, signed in or not.
 */
class EnsureEmailEnabled
{
    public function handle(Request $request, Closure $next): Response
    {
        abort_unless(EmailFeature::enabled(), 404);

        return $next($request);
    }
}
