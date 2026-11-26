<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FinancialAssessment;
use App\Models\Lead;
use App\Scopes\CompanyScope;
use App\Services\FinancialAssessment\AssessmentPresenter;
use App\Support\FeatureFlags;
use App\Support\RequestCompany;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Read-only access to a lead's finalised financial assessments for external services. Drafts are
 * internal working copies and are never exposed. The company comes from the validated API token, and
 * each endpoint needs its own token scope (api.leads.financial-assessments.*), listed in
 * config/api-token-scopes.php. Writing goes through the `lead_fields` of the contact API instead.
 */
class LeadFinancialAssessmentApiController extends Controller
{
    private const MAX_PER_PAGE = 200;

    public function __construct(private readonly AssessmentPresenter $presenter) {}

    /** The lead's finalised assessments, newest first (lines omitted; fetch one for its lines). */
    public function index(Request $request, string $leadId): JsonResponse
    {
        $lead = $this->lead($request, $leadId);
        if ($lead instanceof JsonResponse) {
            return $lead;
        }

        $perPage = min(max((int) $request->query('per_page', 50), 1), self::MAX_PER_PAGE);

        $page = FinancialAssessment::withoutGlobalScope(CompanyScope::class)
            ->where('lead_id', $lead->id)->whereIn('status', ['final', 'superseded'])
            ->orderByDesc('as_of_date')->orderByDesc('id')
            ->paginate($perPage);

        return response()->json([
            'status' => 'success',
            'total' => $page->total(),
            'page' => $page->currentPage(),
            'per_page' => $page->perPage(),
            'data' => $page->getCollection()->map(fn (FinancialAssessment $a) => $this->presenter->forApi($a, false))->values(),
        ]);
    }

    /** The current final assessment with its lines, plus the lead's summary figures. */
    public function current(Request $request, string $leadId): JsonResponse
    {
        $lead = $this->lead($request, $leadId);
        if ($lead instanceof JsonResponse) {
            return $lead;
        }

        $assessment = FinancialAssessment::withoutGlobalScope(CompanyScope::class)
            ->where('lead_id', $lead->id)->where('status', 'final')->first();

        if ($assessment === null) {
            return $this->notFound('This lead has no finalised financial assessment.');
        }

        return response()->json([
            'status' => 'success',
            'summary' => $this->presenter->summaryForApi($lead),
            'data' => $this->presenter->forApi($assessment),
        ]);
    }

    /** One finalised or superseded assessment with its lines. */
    public function show(Request $request, string $leadId, string $assessmentId): JsonResponse
    {
        $lead = $this->lead($request, $leadId);
        if ($lead instanceof JsonResponse) {
            return $lead;
        }

        $assessment = ctype_digit($assessmentId)
            ? FinancialAssessment::withoutGlobalScope(CompanyScope::class)
                ->where('lead_id', $lead->id)->whereIn('status', ['final', 'superseded'])->find((int) $assessmentId)
            : null;

        if ($assessment === null) {
            return $this->notFound('Financial assessment not found.');
        }

        return response()->json(['status' => 'success', 'data' => $this->presenter->forApi($assessment)]);
    }

    /** Ids arrive as strings: Froiden's ApiRoute can't constrain route parameters, so they are checked here. */
    private function lead(Request $request, string $leadId): Lead|JsonResponse
    {
        if (! FeatureFlags::enabled('crm.lead-financial-assessments')) {
            return $this->notFound('Not found.');
        }

        $companyId = RequestCompany::id($request);
        $lead = $companyId && ctype_digit($leadId)
            ? Lead::withoutGlobalScope(CompanyScope::class)->where('company_id', $companyId)->find((int) $leadId)
            : null;

        return $lead ?? $this->notFound('Lead not found.');
    }

    private function notFound(string $message): JsonResponse
    {
        return response()->json(['status' => 'fail', 'message' => $message], 404);
    }
}
