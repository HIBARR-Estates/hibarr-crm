<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Services\TimeRuntimeConformanceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

class TimeHealthController extends Controller
{
    public function __invoke(Request $request, TimeRuntimeConformanceService $service): JsonResponse
    {
        $isAuthenticated = $this->isAuthorizedForDetailedDiagnostics($request);
        $report = $service->checkAndPublish(false, false, $isAuthenticated);

        $utcPayload = [
            'compliant' => $report['utc']['compliant'],
            'appTimezone' => $report['utc']['appTimezone'],
            'cronTimezone' => $report['utc']['cronTimezone'],
            'utcOffsetSeconds' => $report['utc']['utcOffsetSeconds'],
            'loggerTimestampUtc' => $report['utc']['loggerTimestampUtc'],
        ];

        $tzdataPayload = [
            'phpVersion' => $report['tzdata']['version'],
            'source' => $report['tzdata']['source'],
        ];

        if ($isAuthenticated) {
            $utcPayload['phpDefaultTimezone'] = $report['utc']['phpDefaultTimezone'];
            $utcPayload['dbSessionTimezone'] = $report['utc']['dbSessionTimezone'];
            $tzdataPayload['rawPhpTzdbVersion'] = $report['tzdata']['rawPhpTzdbVersion'];
            $tzdataPayload['icuTzdataVersion'] = $report['tzdata']['icuTzdataVersion'];
        }

        return response()->json([
            'status' => $report['healthy'] ? 'healthy' : 'unhealthy',
            'checkedAt' => $report['checkedAt'],
            'utc' => $utcPayload,
            'tzdata' => $tzdataPayload,
        ], $report['healthy'] ? 200 : 503);
    }

    private function isAuthorizedForDetailedDiagnostics(Request $request): bool
    {
        if ($request->user() !== null) {
            return true;
        }

        $configuredToken = config('api.token');
        if (! is_string($configuredToken) || trim($configuredToken) === '') {
            $envToken = env('API_TOKEN');
            $configuredToken = is_string($envToken) ? $envToken : '';
        }

        if (trim($configuredToken) === '') {
            return false;
        }

        $providedToken = $request->header('X-API-TOKEN') ?? $request->bearerToken();
        if (! is_string($providedToken) || $providedToken === '') {
            return false;
        }

        return hash_equals($configuredToken, $providedToken);
    }
}
