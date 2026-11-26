<?php

namespace App\Http\Controllers;

use App\Enums\FinancialAssessmentSource;
use App\Helper\Reply;
use App\Models\FinancialAssessment;
use App\Models\FinancialAssessmentLine;
use App\Models\Lead;
use App\Scopes\CompanyScope;
use App\Services\FinancialAssessment\AssessmentException;
use App\Services\FinancialAssessment\AssessmentPresenter;
use App\Services\FinancialAssessment\AssessmentService;
use App\Services\FinancialAssessment\MissingRatesException;
use App\Services\PermissionService;
use App\Support\FeatureFlags;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * JSON endpoints behind the lead page's Financials tab. Reading needs view
 * access to the lead, every change needs edit access (finer financial
 * permissions arrive in a later phase). Each action answers with the full tab
 * payload, so the page swaps its local state without an Inertia reload.
 */
class LeadFinancialAssessmentController extends AccountBaseController
{
    public function __construct(
        private readonly AssessmentService $assessments,
        private readonly AssessmentPresenter $presenter,
    ) {
        parent::__construct();
        $this->middleware(function ($request, $next) {
            abort_if(! FeatureFlags::enabled('crm.lead-financial-assessments'), 404);
            abort_403(! in_array('leads', user_modules()));

            return $next($request);
        });
    }

    public function show(int $leadId): JsonResponse
    {
        $lead = $this->lead($leadId, 'view_lead');

        return $this->payload($lead);
    }

    public function startDraft(Request $request, int $leadId): JsonResponse
    {
        $lead = $this->lead($leadId, 'edit_lead');
        $data = $request->validate(['source' => 'nullable|string']);

        return $this->act($lead, function () use ($lead, $data) {
            $source = filled($data['source'] ?? null)
                ? (FinancialAssessmentSource::tryFrom((string) $data['source']) ?? throw new AssessmentException('Unknown source.', 'invalid_value'))
                : FinancialAssessmentSource::Manual;

            $this->assessments->startDraft($lead, (int) user()->id, $source);
        });
    }

    public function updateDraft(Request $request, int $leadId): JsonResponse
    {
        $lead = $this->lead($leadId, 'edit_lead');
        $data = $request->validate([
            'as_of_date' => 'sometimes|date',
            'source' => 'sometimes|string',
            'notes' => 'sometimes|nullable|string|max:5000',
        ]);

        return $this->act($lead, fn () => $this->assessments->updateDraft($this->draft($lead), $data));
    }

    public function discardDraft(int $leadId): JsonResponse
    {
        $lead = $this->lead($leadId, 'edit_lead');

        return $this->act($lead, fn () => $this->assessments->discardDraft($this->draft($lead)), __('messages.deleteSuccess'));
    }

    public function addLine(Request $request, int $leadId): JsonResponse
    {
        $lead = $this->lead($leadId, 'edit_lead');
        $data = $request->validate(['type_key' => 'required|string|max:64'] + $this->lineRules());

        return $this->act($lead, fn () => $this->assessments->addLine($this->draft($lead), $data['type_key'], $this->lineAttributes($request)));
    }

    public function updateLine(Request $request, int $leadId, int $line): JsonResponse
    {
        $lead = $this->lead($leadId, 'edit_lead');
        $request->validate($this->lineRules());

        return $this->act($lead, fn () => $this->assessments->updateLine($this->draftLine($lead, $line), $this->lineAttributes($request)));
    }

    public function removeLine(int $leadId, int $line): JsonResponse
    {
        $lead = $this->lead($leadId, 'edit_lead');

        return $this->act($lead, fn () => $this->assessments->removeLine($this->draftLine($lead, $line)), __('messages.deleteSuccess'));
    }

    public function finalise(Request $request, int $leadId): JsonResponse
    {
        $lead = $this->lead($leadId, 'edit_lead');
        $data = $request->validate([
            'manual_rates' => 'sometimes|array',
            'manual_rates.*' => 'nullable|numeric|gt:0',
            'available_now_override' => 'sometimes|nullable|numeric|min:0',
            'override_reason' => 'sometimes|nullable|string|max:2000',
        ]);

        return $this->act($lead, fn () => $this->assessments->finalise($this->draft($lead), (int) user()->id, $data), __('messages.updateSuccess'));
    }

    public function verify(int $leadId, int $assessment): JsonResponse
    {
        $lead = $this->lead($leadId, 'edit_lead');

        return $this->act($lead, function () use ($lead, $assessment) {
            $model = FinancialAssessment::withoutGlobalScope(CompanyScope::class)
                ->where('lead_id', $lead->id)->findOrFail($assessment);

            $this->assessments->verify($model, (int) user()->id);
        }, __('messages.updateSuccess'));
    }

    // ----------------------------------------------------------------- helpers

    /** Runs a change, then answers with the refreshed payload, or with the reason it was refused. */
    private function act(Lead $lead, callable $change, string $message = ''): JsonResponse
    {
        try {
            $change();
        } catch (MissingRatesException $e) {
            return response()->json([
                'status' => 'fail',
                'message' => $e->getMessage(),
                'reason' => $e->reason,
                'missing_rates' => $e->missing,
            ], 422);
        } catch (AssessmentException $e) {
            return response()->json(['status' => 'fail', 'message' => $e->getMessage(), 'reason' => $e->reason], 422);
        }

        return $this->payload($lead, $message);
    }

    private function payload(Lead $lead, string $message = ''): JsonResponse
    {
        $edit = PermissionService::checkAccess(user(), 'edit_lead', $lead, ['added' => 'added_by', 'owned' => 'lead_owner']);

        return response()->json(Reply::successWithData($message, [
            'data' => $this->presenter->workspace($lead, ['view' => true, 'edit' => (bool) $edit['canAccess']]),
        ]));
    }

    private function lead(int $leadId, string $permission): Lead
    {
        $lead = Lead::findOrFail($leadId);

        $access = PermissionService::checkAccess(user(), $permission, $lead, ['added' => 'added_by', 'owned' => 'lead_owner']);
        abort_403(! $access['canAccess']);

        return $lead;
    }

    private function draft(Lead $lead): FinancialAssessment
    {
        return $this->assessments->openDraft($lead) ?? throw AssessmentException::notADraft();
    }

    private function draftLine(Lead $lead, int $lineId): FinancialAssessmentLine
    {
        $draft = $this->draft($lead);

        return FinancialAssessmentLine::withoutGlobalScope(CompanyScope::class)
            ->where('assessment_id', $draft->id)->findOrFail($lineId);
    }

    /** @return array<string, string> */
    private function lineRules(): array
    {
        return [
            'amount' => 'sometimes|numeric|min:0',
            'currency' => 'sometimes|string|max:10',
            'frequency' => 'sometimes|string',
            'certainty' => 'sometimes|string',
            'available_from' => 'sometimes|nullable|date',
            'contributor_label' => 'sometimes|nullable|string|max:120',
            'contributor_lead_id' => 'sometimes|nullable|integer',
            'proof_file_id' => 'sometimes|nullable|integer',
            'note' => 'sometimes|nullable|string|max:2000',
        ];
    }

    /** @return array<string, mixed> */
    private function lineAttributes(Request $request): array
    {
        return $request->only(array_keys($this->lineRules()));
    }
}
