<?php

namespace App\Http\Controllers;

use App\Models\Lead;
use App\Services\EntitySummary\LeadSummaryService;
use App\Support\FeatureFlags;
use Illuminate\Http\JsonResponse;

class LeadSummaryController extends AccountBaseController
{
    public function __construct(
        private LeadSummaryService $leadSummaryService,
    ) {
        parent::__construct();
    }

    public function show(Lead $lead): JsonResponse
    {
        $this->assertFeatureEnabled();
        $this->assertCanViewLead($lead);

        $summary = $this->leadSummaryService->getCached($lead);

        return response()->json([
            'summary' => $summary,
        ]);
    }

    public function regenerate(Lead $lead): JsonResponse
    {
        $this->assertFeatureEnabled();
        $this->assertCanViewLead($lead);

        $summary = $this->leadSummaryService->regenerate($lead);

        return response()->json([
            'summary' => $summary,
        ]);
    }

    private function assertFeatureEnabled(): void
    {
        abort_unless(FeatureFlags::enabled('crm.lead-ai-summary'), 404);
    }

    private function assertCanViewLead(Lead $lead): void
    {
        abort_if((int) $lead->company_id !== (int) company()->id, 404);

        $permission = user()->permission('view_lead');

        abort_unless(in_array($permission, ['all', 'added'], true), 403);

        if ($permission === 'added' && (int) $lead->added_by !== (int) user()->id) {
            abort(403);
        }
    }
}
