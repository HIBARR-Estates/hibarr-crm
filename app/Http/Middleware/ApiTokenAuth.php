<?php

namespace App\Http\Middleware;

use App\Models\ApiToken;
use App\Services\ApiTokenScopeService;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
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

        $tokenData = $this->findTokenRecord($token);

        if (!$tokenData || $tokenData->revoked) {
            $message = !$tokenData ? __('messages.unAuthorisedUser') : __('messages.tokenRevoked');
            return response()->json(['message' => $message], 401);
        }

        $tokenCompanyId = $tokenData->company_id ? (int) $tokenData->company_id : null;
        $requestCompanyId = $this->parseCompanyIdHeader($companyId);

        $resolvedCompanyId = $this->resolveCompanyId($requestCompanyId, $tokenCompanyId);
        if (!$resolvedCompanyId) {
            if ($this->isV2Route($request)) {
                $resolvedCompanyId = 1;
            } else {
                return response()->json(['message' => __('messages.unAuthorisedUser')], 401);
            }
        }

        if ($this->hasCompanyMismatch($requestCompanyId, $tokenCompanyId)) {
            return response()->json(['message' => __('messages.unAuthorisedUser')], 401);
        }

        $request->headers->set('X-COMPANY-ID', (string) $resolvedCompanyId);

        $routeName = $request->route()?->getName();
        if (!ApiTokenScopeService::routeAllowed($routeName, $tokenData->permissions ?? null)) {
            return response()->json([
                'message' => __('messages.apiTokenEndpointForbidden'),
            ], 403);
        }

        return $next($request);
    }

    private function findTokenRecord(string $token): ?object
    {
        $hashed = ApiToken::hashToken($token);

        return DB::table('api_tokens')
            ->where('token', $hashed)
            ->orWhere('token', $token)
            ->first();
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

    private function resolveCompanyId(?int $requestCompanyId, ?int $tokenCompanyId): ?int
    {
        return $requestCompanyId ?? $tokenCompanyId;
    }

    private function isV2Route(Request $request): bool
    {
        $path = ltrim((string) $request->path(), '/');

        return $path === 'api/v2' || str_starts_with($path, 'api/v2/');
    }

    private function hasCompanyMismatch(?int $requestCompanyId, ?int $tokenCompanyId): bool
    {
        return (bool) ($requestCompanyId && $tokenCompanyId && $requestCompanyId !== $tokenCompanyId);
    }
}
