<?php

namespace App\Http\Middleware;

use App\Helper\Reply;
use App\Support\FeatureFlags;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureCrmWriteClientEnabled
{
    public function handle(Request $request, Closure $next): Response
    {
        if (!FeatureFlags::enabled('sally.crm-write-client')) {
            return response()->json(
                Reply::error('CRM write client endpoints are not enabled.'),
                404
            );
        }

        return $next($request);
    }
}
