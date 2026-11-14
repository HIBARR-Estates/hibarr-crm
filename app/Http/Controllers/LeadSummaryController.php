<?php

namespace App\Http\Controllers;

use App\Exceptions\EntityAiSummaryGenerationException;
use App\Models\Lead;
use App\Services\EntitySummary\LeadSummaryService;
use App\Services\PermissionService;
use App\Support\FeatureFlags;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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
            'is_stale' => (bool) ($summary['meta']['is_stale'] ?? false),
        ]);
    }

    /**
     * `if_needed=1` is what the page sends on load: generate only when there is no summary or it
     * is stale, otherwise answer with the stored one. Without it this always regenerates
     * (the Regenerate / Refresh buttons).
     */
    public function regenerate(Request $request, Lead $lead): JsonResponse
    {
        $this->assertFeatureEnabled();
        $this->assertCanViewLead($lead);

        try {
            $summary = $this->leadSummaryService->regenerate($lead, $request->boolean('if_needed'));
        } catch (EntityAiSummaryGenerationException $e) {
            return response()->json([
                'message' => $e->getMessage(),
                'summary' => $e->existingSummary(),
                'is_stale' => (bool) (($e->existingSummary()['meta']['is_stale'] ?? false)),
            ], $e->getCode() >= 400 ? $e->getCode() : 503);
        }

        return response()->json([
            'summary' => $summary,
            'is_stale' => false,
        ]);
    }

    private function assertFeatureEnabled(): void
    {
        abort_unless(FeatureFlags::enabled('crm.lead-ai-summary'), 404);
    }

    private function assertCanViewLead(Lead $lead): void
    {
        abort_if((int) $lead->company_id !== (int) company()->id, 404);

        $leadRules = [
            'added' => 'added_by',
            'owned' => 'lead_owner',
        ];

        $access = PermissionService::checkAccess(user(), 'view_lead', $lead, $leadRules);

        abort_unless($access['canAccess'], 403);
    }
}
