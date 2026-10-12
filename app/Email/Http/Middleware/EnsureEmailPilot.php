<?php

namespace App\Email\Http\Middleware;

use App\Email\EmailFeature;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * The flag alone never opens Email: the signed-in user, or their company,
 * must be on the pilot allowlist. Runs after auth.
 */
class EnsureEmailPilot
{
    public function handle(Request $request, Closure $next): Response
    {
        abort_unless(EmailFeature::enabledFor($request->user()), 403);

        return $next($request);
    }
}
