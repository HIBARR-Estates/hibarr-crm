<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * For API routes shared by the CRM frontend and external services. A signed-in,
 * active session user (Sanctum stateful request from the app itself) acts for
 * their own company; anyone else must present a valid API token.
 */
class ApiTokenOrSession
{
    public function __construct(private ApiTokenAuth $apiTokenAuth)
    {
    }

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && $user->status === 'active' && $user->login === 'enable') {
            // Controllers read the tenant from this header; the browser must not choose it.
            $request->headers->set('X-COMPANY-ID', (string) $user->company_id);

            return $next($request);
        }

        return $this->apiTokenAuth->handle($request, $next);
    }
}
