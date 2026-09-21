<?php

namespace App\Http\Middleware;

use App\Models\ApiToken;
use App\Services\ApiTokenScopeService;
use App\Support\RequestCompany;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

class ApiTokenAuth
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $token = $this->extractToken($request);
        $companyId = $request->header('X-COMPANY-ID');

        Log::info("Company ID: " . $companyId);

        if (!$token) {
            return response()->json(['message' => __('messages.unAuthorisedUser')], 401);
        }

        $tokenData = ApiToken::findByPlainToken($token);

        if (!$tokenData || $tokenData->revoked) {
            $message = !$tokenData ? __('messages.unAuthorisedUser') : __('messages.tokenRevoked');
            return response()->json(['message' => $message], 401);
        }

        // A token only acts for the company it was issued to. The header may
        // repeat that company but never pick another one, and a token with no
        // company is refused rather than guessed.
        $tokenCompanyId = $tokenData->company_id ? (int) $tokenData->company_id : null;
        $requestCompanyId = $this->parseCompanyIdHeader($companyId);

        if (!$tokenCompanyId || $this->hasCompanyMismatch($requestCompanyId, $tokenCompanyId)) {
            return response()->json(['message' => __('messages.unAuthorisedUser')], 401);
        }

        $request->headers->set('X-COMPANY-ID', (string) $tokenCompanyId);

        $routeName = $request->route()?->getName();
        if (!ApiTokenScopeService::routeAllowed($routeName, $tokenData->permissions ?? null, $tokenData->isUnrestricted())) {
            return response()->json([
                'message' => __('messages.apiTokenEndpointForbidden'),
            ], 403);
        }

        // The validated company (see RequestCompany::id()), kept apart from the
        // header so controllers can tell it from a client-sent value.
        $request->attributes->set(RequestCompany::TOKEN_COMPANY_ATTRIBUTE, (int) $request->header('X-COMPANY-ID'));

        return $next($request);
    }

    /**
     * Extract API token from supported headers.
     *
     * Supports:
     * - X-API-TOKEN: <token> (existing)
     * - Authorization: Bearer <token> (v2 spec)
     */
    private function extractToken(Request $request): ?string
    {
        $token = $request->header('X-API-TOKEN');
        $authorization = $request->header('Authorization');

        if (!$token && $authorization && is_string($authorization)) {
            $token = preg_match('/Bearer\\s+(.*)$/i', $authorization, $m) ? ($m[1] ?? null) : null;
        }

        return $token ?: null;
    }

    private function parseCompanyIdHeader($companyIdHeader): ?int
    {
        if (!$companyIdHeader) {
            return null;
        }

        return is_numeric($companyIdHeader) ? (int) $companyIdHeader : null;
    }

    private function hasCompanyMismatch(?int $requestCompanyId, int $tokenCompanyId): bool
    {
        return $requestCompanyId !== null && $requestCompanyId !== $tokenCompanyId;
    }
}
