<?php

namespace App\Http\Controllers;

use App\Helper\Reply;
use App\Models\Lead;
use App\Models\LeadQualification;
use App\Services\LeadQualificationService;
use App\Services\PermissionService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class LeadQualificationController extends AccountBaseController
{
    public function __construct(
        protected LeadQualificationService $qualificationService
    ) {
        parent::__construct();

        $this->middleware(function ($request, $next) {
            if (! in_array('leads', user_modules())) {
                if ($request->ajax() || $request->header('X-Inertia')) {
                    return redirect()->back()->with('error', __('messages.permissionDenied'));
                }
                abort(403);
            }

            return $next($request);
        });
    }

    public function index(Lead $lead)
    {
        $this->authorizeLeadAccess($lead);

        return Reply::dataOnly(
            $this->qualificationService->resolveWorkspaceForLead($lead)
        );
    }

    public function store(Request $request, Lead $lead)
    {
        $this->authorizeLeadAccess($lead);

        $validated = $request->validate([
            'template_id' => ['required', 'string', 'max:255'],
            'template_version' => ['required', 'integer', 'min:1'],
            'template_name' => ['nullable', 'string', 'max:255'],
            'agent_language' => ['nullable', 'string', 'max:10'],
            'current_segment_key' => ['nullable', 'string', 'max:255'],
            'selected_branch_keys' => ['nullable', 'array'],
            'selected_branch_keys.*' => ['string', 'max:255'],
        ]);

        $qualification = $this->qualificationService->start($lead, $validated);

        return Reply::successWithData(__('messages.recordSaved'), [
            'qualification' => $qualification,
        ]);
    }

    public function upsertAnswer(Request $request, LeadQualification $qualification)
    {
        $this->authorizeQualificationAccess($qualification);

        $validated = $request->validate([
            'segment_key' => ['required', 'string', 'max:255'],
            'answer_values' => ['nullable', 'array'],
            'answer_text' => ['nullable', 'string'],
        ]);

        $answer = $this->qualificationService->upsertAnswer($qualification, $validated);

        return Reply::successWithData(__('messages.recordSaved'), [
            'answer' => $answer,
        ]);
    }

    public function updateNavigation(Request $request, LeadQualification $qualification)
    {
        $this->authorizeQualificationAccess($qualification);

        $validated = $request->validate([
            'current_segment_key' => ['nullable', 'string', 'max:255'],
            'selected_branch_keys' => ['nullable', 'array'],
            'selected_branch_keys.*' => ['string', 'max:255'],
        ]);

        $updated = $this->qualificationService->updateNavigation($qualification, $validated);

        return Reply::successWithData(__('messages.updateSuccess'), [
            'qualification' => $updated,
        ]);
    }

    public function complete(Request $request, LeadQualification $qualification)
    {
        $this->authorizeQualificationAccess($qualification);

        $outcomeValues = ['bookMeeting', 'inviteWebinar', 'callback', 'noFit'];

        $validated = $request->validate([
            'outcomes' => ['nullable', 'array', 'min:1'],
            'outcomes.*' => ['string', Rule::in($outcomeValues)],
            'outcome' => ['nullable', 'string', Rule::in($outcomeValues)],
            'outcome_comment' => ['nullable', 'string'],
            'selected_branch_keys' => ['nullable', 'array'],
            'selected_branch_keys.*' => ['string', 'max:255'],
            'outcome_triggered_at' => ['nullable', 'date'],
            'webinar_session_label' => ['nullable', 'string', 'max:255'],
            'actions' => ['nullable', 'array'],
            'actions.*.type' => ['required_with:actions', 'string', 'max:64'],
            'actions.*.config' => ['nullable', 'array'],
        ]);

        if (empty($validated['outcomes'])) {
            if (empty($validated['outcome'])) {
                throw ValidationException::withMessages([
                    'outcomes' => ['At least one outcome is required.'],
                ]);
            }
            $validated['outcomes'] = [$validated['outcome']];
        }

        $result = $this->qualificationService->complete($qualification, $validated);

        return Reply::successWithData(__('messages.recordSaved'), [
            'qualification' => $result['qualification'],
            'lead' => $result['lead'],
        ]);
    }

    public function executeAction(
        Request $request,
        LeadQualification $qualification,
        \App\Models\LeadQualificationActionRun $actionRun
    ) {
        $this->authorizeQualificationAccess($qualification);

        if ((int) $actionRun->lead_qualification_id !== (int) $qualification->id) {
            throw ValidationException::withMessages([
                'action' => ['Action does not belong to this qualification.'],
            ]);
        }

        $validated = $request->validate([
            'payload' => ['nullable', 'array'],
            'error' => ['nullable', 'string'],
        ]);

        $updated = $this->qualificationService->markActionExecuted(
            $actionRun,
            $validated['payload'] ?? [],
            $validated['error'] ?? null
        );

        return Reply::successWithData(__('messages.updateSuccess'), [
            'action_run' => $updated,
            'qualification' => $qualification->fresh()->load(['answers', 'agent:id,name,image', 'actionRuns']),
        ]);
    }

    public function abandon(LeadQualification $qualification)
    {
        $this->authorizeQualificationAccess($qualification);

        $abandoned = $this->qualificationService->abandon($qualification);

        return Reply::successWithData(__('messages.updateSuccess'), [
            'qualification' => $abandoned,
        ]);
    }

    public function destroy(LeadQualification $qualification)
    {
        $this->authorizeQualificationAccess($qualification);

        $lead = $qualification->lead()->firstOrFail();
        $this->qualificationService->delete($qualification);

        return Reply::successWithData(__('messages.deleteSuccess'), [
            'workspace' => $this->qualificationService->resolveWorkspaceForLead($lead),
        ]);
    }

    public function clearBranchAnswers(Request $request, LeadQualification $qualification)
    {
        $this->authorizeQualificationAccess($qualification);

        $validated = $request->validate([
            'segment_keys' => ['required', 'array', 'min:1'],
            'segment_keys.*' => ['string', 'max:255'],
        ]);

        $deletedCount = $this->qualificationService->clearBranchAnswers(
            $qualification,
            $validated['segment_keys']
        );

        return Reply::successWithData(__('messages.deleteSuccess'), [
            'deleted_count' => $deletedCount,
            'qualification' => $qualification->fresh()->load('answers'),
        ]);
    }

    private function authorizeLeadAccess(Lead $lead): void
    {
        $access = PermissionService::checkAccess(user(), 'view_lead', $lead, [
            'added' => 'added_by',
            'owned' => 'lead_owner',
        ]);

        if (! $access['canAccess']) {
            throw ValidationException::withMessages([
                'permission' => [__('messages.permissionDenied')],
            ]);
        }
    }

    private function authorizeQualificationAccess(LeadQualification $qualification): void
    {
        $lead = $qualification->lead()->firstOrFail();
        $this->authorizeLeadAccess($lead);
    }
}
