<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Illuminate\Support\Facades\DB;

class ApiTokenAuth
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->header('X-API-TOKEN');

        if (!$token || !DB::table('api_tokens')->where('token', $token)->exists()) {
            return response()->json(['message' => __('messages.unAuthorisedUser')], 401);
        }
        // check if token is revoked
        $tokenData = DB::table('api_tokens')->where('token', $token)->first();
        if ($tokenData->revoked) {
            return response()->json(['message' => __('messages.tokenRevoked')], 401);
        }

        return $next($request);
    }
}
