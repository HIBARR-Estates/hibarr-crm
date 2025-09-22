<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

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
        $companyId = $request->header('X-COMPANY-ID');

        Log::info("API Token: " . $token);
        Log::info("Company ID: " . $companyId);

        // Check if both token and company ID are provided
        if (!$token || !$companyId) {
            return response()->json(['message' => __('messages.unAuthorisedUser')], 401);
        }

        // Single query to check token existence, company match, and revoked status
        $tokenData = DB::table('api_tokens')
            ->where('token', $token)
            ->where('company_id', $companyId)
            ->first();

        if (!$tokenData || $tokenData->revoked) {
            $message = !$tokenData ? __('messages.unAuthorisedUser') : __('messages.tokenRevoked');
            return response()->json(['message' => $message], 401);
        }

        return $next($request);
    }
}
