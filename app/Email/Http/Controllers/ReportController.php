<?php

namespace App\Email\Http\Controllers;

use App\Email\Authorization\EmailAccess;
use App\Email\Observability\EmailLog;
use App\Email\Report\WorkReport;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;

/**
 * Manager work report: counts of stuck routing, open email-linked tasks,
 * unresolved handoffs, and delivery/sync faults. Metadata only — no bodies.
 */
class ReportController
{
    public function __construct(
        private readonly EmailAccess $access,
        private readonly WorkReport $report,
    ) {}

    public function index(Request $request): JsonResponse|InertiaResponse
    {
        $user = $request->user();

        if (! $this->access->canViewWorkReport($user)) {
            EmailLog::permissionDenied('work_report.view', [
                'user_id' => $user?->id,
                'company_id' => $user?->company_id,
            ]);
            abort(403);
        }

        $payload = $this->report->forCompany($user);

        if ($this->wantsPage($request)) {
            return Inertia::render('Email/WorkReport', $payload);
        }

        return response()->json($payload);
    }

    private function wantsPage(Request $request): bool
    {
        if ($request->header('X-Inertia')) {
            return true;
        }

        if ($request->expectsJson()) {
            return false;
        }

        return $request->acceptsHtml();
    }
}
