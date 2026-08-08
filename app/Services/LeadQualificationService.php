<?php

namespace App\Services;

use App\Enums\QualificationActionRunStatus;
use App\Enums\QualificationActionType;
use App\Enums\QualificationOutcome;
use App\Enums\QualificationStatus;
use App\Models\Lead;
use App\Models\LeadLifecycleStatus;
use App\Models\LeadQualification;
use App\Models\LeadQualificationActionRun;
use App\Models\LeadQualificationAnswer;
use App\Services\Qualification\QualificationActionCatalog;
use App\Services\Qualification\QualificationOutcomePolicy;
use App\Traits\RecordsCrmEvents;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

class LeadQualificationService
{
    use RecordsCrmEvents;

    public function listForLead(Lead $lead): Collection
    {
        return LeadQualification::where('lead_id', $lead->id)
            ->with(['answers', 'agent:id,name,image', 'actionRuns'])
            ->orderByDesc('started_at')
            ->orderByDesc('id')
            ->get();
    }

    public function resolveWorkspaceForLead(Lead $lead): array
    {
        $qualifications = $this->listForLead($lead);

        $current = $qualifications->first(
            fn (LeadQualification $qualification) => $qualification->status === QualificationStatus::InProgress
        ) ?? $qualifications->first(
            fn (LeadQualification $qualification) => $qualification->status === QualificationStatus::Completed
        );

        $history = $qualifications
            ->filter(fn (LeadQualification $qualification) => ! $current || $qualification->id !== $current->id)
            ->values();

        return [
            'current' => $current,
            'history' => $history,
        ];
    }

    public function start(Lead $lead, array $data): LeadQualification
    {
        $qualifyingStatus = $this->resolveLifecycleStatus($lead->company_id, 'qualifying');

        $qualification = LeadQualification::create([
            'company_id' => $lead->company_id,
            'lead_id' => $lead->id,
            'template_id' => $data['template_id'],
            'template_version' => $data['template_version'],
            'template_name' => $data['template_name'] ?? null,
            'agent_id' => $data['agent_id'] ?? user()->id,
            'status' => QualificationStatus::InProgress,
            'agent_language' => $data['agent_language'] ?? null,
            'selected_branch_keys' => $data['selected_branch_keys'] ?? [],
            'current_segment_key' => $data['current_segment_key'] ?? null,
            'started_at' => now(),
        ]);

        if ($qualifyingStatus) {
            $lead->lead_lifecycle_status_id = $qualifyingStatus->id;
            $lead->save();
        }

        return $qualification->load(['answers', 'agent:id,name,image', 'actionRuns']);
    }

    public function upsertAnswer(LeadQualification $qualification, array $data): LeadQualificationAnswer
    {
        $this->assertInProgress($qualification);

        return LeadQualificationAnswer::updateOrCreate(
            [
                'lead_qualification_id' => $qualification->id,
                'segment_key' => $data['segment_key'],
            ],
            [
                'answer_values' => $data['answer_values'] ?? [],
                'answer_text' => $data['answer_text'] ?? null,
            ]
        );
    }

    public function updateNavigation(LeadQualification $qualification, array $data): LeadQualification
    {
        $this->assertInProgress($qualification);

        if (array_key_exists('current_segment_key', $data)) {
            $qualification->current_segment_key = $data['current_segment_key'];
        }

        if (array_key_exists('selected_branch_keys', $data)) {
            $qualification->selected_branch_keys = $data['selected_branch_keys'];
        }

        $qualification->save();

        return $qualification->load(['answers', 'agent:id,name,image']);
    }

    public function complete(LeadQualification $qualification, array $data): LeadQualification
    {
        $this->assertInProgress($qualification);

        $policy = app(QualificationOutcomePolicy::class);
        $rawOutcomes = $data['outcomes'] ?? (isset($data['outcome']) ? [$data['outcome']] : []);
        $outcomeValues = $policy->normalizeToValues($rawOutcomes);
        $winner = $policy->resolveWinner($outcomeValues);
        $lifecycleKey = $winner->lifecycleStatusKey();
        $lifecycleStatus = $this->resolveLifecycleStatus($qualification->company_id, $lifecycleKey);

        $qualification->status = QualificationStatus::Completed;
        $qualification->outcomes = $outcomeValues;
        $qualification->outcome = $winner;
        $qualification->outcome_comment = $data['outcome_comment'] ?? null;
        $qualification->outcome_triggered_at = isset($data['outcome_triggered_at'])
            ? $data['outcome_triggered_at']
            : now();
        if (array_key_exists('selected_branch_keys', $data)) {
            $qualification->selected_branch_keys = $data['selected_branch_keys'];
        }
        $qualification->completed_at = now();
        $qualification->save();

        $this->seedActionRuns($qualification, $data['actions'] ?? []);

        $lead = Lead::withoutGlobalScopes()->find($qualification->lead_id);
        if ($lead && $lifecycleStatus) {
            $lead->lead_lifecycle_status_id = $lifecycleStatus->id;
            $lead->save();
        }

        $this->recordCrmEvent('qualification_completed', $lead ?? $qualification, [
            'metadata' => [
                'qualification_id' => $qualification->id,
                'template_id' => $qualification->template_id,
                'template_version' => $qualification->template_version,
                'outcome' => $winner->value,
                'outcomes' => $outcomeValues,
                'winning_outcome' => $winner->value,
                'lifecycle_status_key' => $lifecycleKey,
                'outcome_comment' => $qualification->outcome_comment,
                'comment' => $this->outcomeComment($winner, $data),
            ],
        ]);

        return $qualification->load(['answers', 'agent:id,name,image', 'actionRuns']);
    }

    /**
     * @param  list<array{type?: string, config?: array<string, mixed>|null}>  $actions
     */
    public function seedActionRuns(LeadQualification $qualification, array $actions): void
    {
        $catalog = app(QualificationActionCatalog::class);
        $seen = [];

        foreach ($actions as $action) {
            $type = is_array($action) ? (string) ($action['type'] ?? '') : '';
            if ($type === '' || isset($seen[$type])) {
                continue;
            }
            $seen[$type] = true;

            $enum = QualificationActionType::tryFrom($type);
            $status = $enum === null || $catalog->statusFor($type) === QualificationActionCatalog::STATUS_COMING_SOON
                ? QualificationActionRunStatus::Unavailable
                : QualificationActionRunStatus::Pending;

            LeadQualificationActionRun::create([
                'lead_qualification_id' => $qualification->id,
                'action_type' => $type,
                'status' => $status,
                'config' => is_array($action['config'] ?? null) ? $action['config'] : [],
            ]);
        }
    }

    public function markActionExecuted(
        LeadQualificationActionRun $actionRun,
        array $payload = [],
        ?string $error = null
    ): LeadQualificationActionRun {
        $qualification = $actionRun->qualification;
        if (! $qualification || $qualification->status !== QualificationStatus::Completed) {
            throw ValidationException::withMessages([
                'status' => ['Actions can only be executed on a completed qualification.'],
            ]);
        }

        if ($actionRun->status === QualificationActionRunStatus::Completed) {
            return $actionRun;
        }

        $catalog = app(QualificationActionCatalog::class);
        $type = $actionRun->action_type;

        if ($actionRun->status === QualificationActionRunStatus::Unavailable
            || ! $catalog->isExecutable($type)
        ) {
            throw ValidationException::withMessages([
                'action' => ['This action is not available to execute.'],
            ]);
        }

        if ($error) {
            $actionRun->status = QualificationActionRunStatus::Failed;
            $actionRun->error = $error;
            $actionRun->payload = $payload ?: $actionRun->payload;
            $actionRun->save();

            return $actionRun->fresh();
        }

        // Client has already performed registration side effects for executable
        // types; no-ops complete immediately with empty payload.
        $actionRun->status = QualificationActionRunStatus::Completed;
        $actionRun->payload = $payload;
        $actionRun->error = null;
        $actionRun->completed_at = now();
        $actionRun->save();

        return $actionRun->fresh();
    }

    public function abandon(LeadQualification $qualification): LeadQualification
    {
        $this->assertInProgress($qualification);

        $qualification->status = QualificationStatus::Abandoned;
        $qualification->save();

        return $qualification->load(['answers', 'agent:id,name,image']);
    }

    public function clearBranchAnswers(LeadQualification $qualification, array $segmentKeys): int
    {
        $this->assertInProgress($qualification);

        if (empty($segmentKeys)) {
            return 0;
        }

        return LeadQualificationAnswer::where('lead_qualification_id', $qualification->id)
            ->whereIn('segment_key', $segmentKeys)
            ->delete();
    }

    private function assertInProgress(LeadQualification $qualification): void
    {
        if ($qualification->status !== QualificationStatus::InProgress) {
            throw ValidationException::withMessages([
                'status' => ['Qualification is not in progress.'],
            ]);
        }
    }

    private function resolveLifecycleStatus(int $companyId, string $key): ?LeadLifecycleStatus
    {
        return LeadLifecycleStatus::findByKey($companyId, $key);
    }

    private function outcomeComment(QualificationOutcome $outcome, array $data): string
    {
        return match ($outcome) {
            QualificationOutcome::BookMeeting => 'Consultation booked',
            QualificationOutcome::InviteWebinar => $data['webinar_session_label'] ?? 'Webinar session registered',
            QualificationOutcome::Callback => 'Callback requested',
            QualificationOutcome::NoFit => 'Not a fit',
        };
    }
}
