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
        $report = $service->checkAndPublish(false);

        return response()->json([
            'status' => $report['healthy'] ? 'healthy' : 'unhealthy',
            'checkedAt' => $report['checkedAt'],
            'utc' => [
                'compliant' => $report['utc']['compliant'],
                'phpDefaultTimezone' => $report['utc']['phpDefaultTimezone'],
                'appTimezone' => $report['utc']['appTimezone'],
                'cronTimezone' => $report['utc']['cronTimezone'],
                'dbSessionTimezone' => $report['utc']['dbSessionTimezone'],
                'utcOffsetSeconds' => $report['utc']['utcOffsetSeconds'],
                'loggerTimestampUtc' => $report['utc']['loggerTimestampUtc'],
            ],
            'tzdata' => [
                'phpVersion' => $report['tzdata']['version'],
                'rawPhpTzdbVersion' => $report['tzdata']['rawPhpTzdbVersion'],
                'icuTzdataVersion' => $report['tzdata']['icuTzdataVersion'],
                'source' => $report['tzdata']['source'],
            ],
        ], $report['healthy'] ? 200 : 503);
    }
}
