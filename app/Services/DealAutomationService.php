<?php

namespace App\Services;

use App\Enums\IntegrationOrigin;
use App\Events\DealWonEvent;
use App\Mail\DealAutomationTemplateEmail;
use App\Models\Deal;
use App\Models\DealAutomation;
use App\Models\DealAutomationLog;
use App\Models\DealAutomationPendingRun;
use App\Models\DealNote;
use App\Models\EmailDeliveryLog;
use App\Models\Lead;
use App\Models\LeadNote;
use App\Models\PipelineStage;
use App\Models\User;
use App\Services\Notifications\MailDeliveryRecorder;
use App\Support\AutomationV2Feature;
use App\Traits\RecordsCrmEvents;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

class DealAutomationService
{
    use RecordsCrmEvents;

    protected FieldResolverService $fieldResolver;

    protected ConditionEvaluatorService $conditionEvaluator;

    protected MailDeliveryRecorder $mailDeliveryRecorder;

    /**
     * The execution currently running, stamped on every log row it writes so
     * a multi-action automation reads as one run with N steps instead of N
     * runs. Set by executeActions() and never read outside it — actions run
     * synchronously to completion within a single call, so there is never
     * more than one live execution per service instance.
     */
    protected ?string $currentRunId = null;

    public function __construct(
        FieldResolverService $fieldResolver,
        ConditionEvaluatorService $conditionEvaluator,
        MailDeliveryRecorder $mailDeliveryRecorder
    ) {
        $this->fieldResolver = $fieldResolver;
        $this->conditionEvaluator = $conditionEvaluator;
        $this->mailDeliveryRecorder = $mailDeliveryRecorder;
    }

    /**
     * Process deal-subject automations for a deal based on its current state
     * and an optional trigger. Matches automations scoped to the deal's own
     * pipeline as well as ones with no pipeline scope (run for any pipeline).
     */
    public function process(Deal $deal, ?string $trigger = null): void
    {
        // Skip automation for locked deals (full freeze or commission already paid)
        if ($deal->is_locked || $deal->isCommissionLocked()) {
            Log::info("Skipping automations for locked Deal ID: {$deal->id}");

            return;
        }

        Log::info("Processing automations for Deal ID: {$deal->id}, Trigger: ".($trigger ?? 'None'));

        $automations = $this->getAutomations($deal->lead_pipeline_id, $trigger, DealAutomation::SUBJECT_DEAL);

        foreach ($automations as $automation) {
            if (! AutomationV2Feature::supportsAutomation($automation)) {
                AutomationV2Feature::warnIfUnsupported($automation);

                continue;
            }

            if ($this->evaluateConditions($deal, $automation)) {
                Log::info("Automation matched: {$automation->name} (ID: {$automation->id})");
                $this->dispatchOrWait($deal, $automation, $trigger);
            }
        }
    }

    /**
     * Process lead-subject automations for a lead based on its current state
     * and an optional trigger. Leads aren't pipeline-scoped.
     */
    public function processLead(Lead $lead, ?string $trigger = null): void
    {
        if (! AutomationV2Feature::enabled()) {
            return;
        }

        Log::info("Processing automations for Lead ID: {$lead->id}, Trigger: ".($trigger ?? 'None'));

        $automations = $this->getAutomations(null, $trigger, DealAutomation::SUBJECT_LEAD);

        foreach ($automations as $automation) {
            if (! AutomationV2Feature::supportsAutomation($automation)) {
                AutomationV2Feature::warnIfUnsupported($automation);

                continue;
            }

            if ($this->evaluateConditions($lead, $automation)) {
                Log::info("Automation matched: {$automation->name} (ID: {$automation->id})");
                $this->dispatchOrWait($lead, $automation, $trigger);
            }
        }
    }

    /**
     * Run one date_based automation against a single matched subject (see
     * ProcessAutomationDateTriggers for how subjects are matched). Conditions
     * still apply — a birthday automation with condition temperature = hot
     * only fires for hot leads.
     */
    public function runDateBased(Deal|Lead $subject, DealAutomation $automation): void
    {
        if (! AutomationV2Feature::enabled()) {
            return;
        }

        if ($subject instanceof Deal && ($subject->is_locked || $subject->isCommissionLocked())) {
            Log::info("Skipping date-based automation for locked Deal ID: {$subject->id}");

            return;
        }

        if (! $this->evaluateConditions($subject, $automation)) {
            Log::info("Date-based automation conditions not met: {$automation->name} (ID: {$automation->id})");

            return;
        }

        Log::info("Date-based automation matched: {$automation->name} (ID: {$automation->id})");
        $this->dispatchOrWait($subject, $automation, DealAutomation::TRIGGER_DATE_BASED);
    }

    /**
     * Either execute the automation's actions now, or — when a wait is
     * configured — queue a pending run for later. Conditions were already
     * met here; they are checked AGAIN at execution time (see runPending())
     * because the deal/lead may have changed during the wait.
     *
     * Only one pending run per automation+subject can exist at a time, so
     * triggers that fire on every save (deal_updated etc.) can't stack
     * duplicates while one is already waiting.
     */
    protected function dispatchOrWait(Deal|Lead $subject, DealAutomation $automation, ?string $trigger): void
    {
        $waitSeconds = AutomationV2Feature::enabled()
            ? $this->automationWaitSeconds($automation)
            : 0;

        if ($waitSeconds <= 0) {
            // The wait path below is naturally deduped by DealAutomationPendingRun's
            // unique index, but immediate execution has no such guard — two
            // near-simultaneous saves for the same deal/lead (a double form
            // submit, two requests firing close together) each independently
            // match conditions and would otherwise both run the full action
            // list, creating duplicate tasks/notes/stage-transitions. A short
            // per-(automation, subject, trigger) lock closes double-submit gaps
            // without blocking a different trigger for the same record.
            if (AutomationV2Feature::enabled() && ! $this->claimImmediateRun($subject, $automation, $trigger)) {
                $label = $subject instanceof Lead ? "Lead ID: {$subject->id}" : "Deal ID: {$subject->id}";
                Log::info("Skipping duplicate immediate run for '{$automation->name}' (ID: {$automation->id}) — already ran moments ago for {$label}.");

                return;
            }

            $this->executeActions($subject, $automation);

            return;
        }

        try {
            DealAutomationPendingRun::firstOrCreate([
                'deal_automation_id' => $automation->id,
                'subject_type' => $subject instanceof Lead ? DealAutomation::SUBJECT_LEAD : DealAutomation::SUBJECT_DEAL,
                'subject_id' => $subject->id,
            ], [
                'company_id' => $subject->company_id,
                'trigger' => $trigger,
                'run_at' => now()->addSeconds($waitSeconds),
            ]);
        } catch (\Exception $e) {
            Log::error("Failed to queue waited automation '{$automation->name}' (ID: {$automation->id})", [
                'subject_type' => $subject instanceof Lead ? 'lead' : 'deal',
                'subject_id' => $subject->id,
                'exception' => $e->getMessage(),
            ]);

            return;
        }

        Log::info("Automation queued to run after wait: {$automation->name} (ID: {$automation->id}), at ".now()->addSeconds($waitSeconds)->toDateTimeString());
    }

    /**
     * Claims a short window for this (automation, subject) pair — true the
     * first time it's called within the window, false for any repeat call
     * while the lock is held. Scoped by trigger so deal_created followed by
     * deal_updated within the window both run; only duplicate calls for the
     * same trigger are suppressed.
     */
    protected function claimImmediateRun(Deal|Lead $subject, DealAutomation $automation, ?string $trigger): bool
    {
        $subjectType = $subject instanceof Lead ? DealAutomation::SUBJECT_LEAD : DealAutomation::SUBJECT_DEAL;
        $triggerKey = $trigger ?? 'any';
        $key = "deal_automation_run_lock:{$automation->id}:{$subjectType}:{$subject->id}:{$triggerKey}";

        return Cache::add($key, true, now()->addSeconds(2));
    }

    /**
     * Execute one pending run: called from the scheduler once run_at is due.
     * Everything is re-validated here because state may have moved on since
     * the trigger fired — the automation may have been deactivated or its
     * conditions may no longer hold; locked deals are skipped like in
     * process(); deleted subjects simply have their row dropped.
     */
    public function runPending(DealAutomationPendingRun $pendingRun): bool
    {
        if (! AutomationV2Feature::enabled()) {
            return true;
        }

        $processingKey = "deal_automation_pending_run:{$pendingRun->id}";
        if (! Cache::add($processingKey, true, now()->addMinutes(10))) {
            Log::info("Skipping pending automation run #{$pendingRun->id}: already being processed.");

            return false;
        }

        try {
            return $this->executePendingRun($pendingRun);
        } finally {
            Cache::forget($processingKey);
        }
    }

    protected function executePendingRun(DealAutomationPendingRun $pendingRun): bool
    {
        $subject = $pendingRun->subject_type === DealAutomation::SUBJECT_LEAD
            ? Lead::find($pendingRun->subject_id)
            : Deal::find($pendingRun->subject_id);

        if (! $subject) {
            Log::info("Dropping pending automation run #{$pendingRun->id}: subject no longer exists");

            return true;
        }

        $automation = $pendingRun->automation;

        if (! $automation || ! $automation->active) {
            Log::info("Skipping pending automation run #{$pendingRun->id}: automation inactive or missing");

            return true;
        }

        if ($subject instanceof Deal && ($subject->is_locked || $subject->isCommissionLocked())) {
            Log::info("Skipping pending automation run #{$pendingRun->id}: Deal {$subject->id} is locked");

            return true;
        }

        if (! $this->evaluateConditions($subject, $automation)) {
            Log::info("Conditions no longer met after wait for '{$automation->name}' (ID: {$automation->id}) on {$pendingRun->subject_type} {$pendingRun->subject_id}");

            return true;
        }

        Log::info("Waited automation executing: {$automation->name} (ID: {$automation->id})");

        // run_id is only set when a mid-sequence wait step queued this row —
        // a pre-actions wait starts a fresh execution, so null is correct there.
        return $this->executeActions($subject, $automation, $pendingRun->resume_action_id, $pendingRun->run_id);
    }

    /**
     * The configured wait in seconds — 0 means "no wait, run immediately".
     */
    public function automationWaitSeconds(DealAutomation $automation): int
    {
        return $this->computeWaitSeconds($automation->wait_duration_value, $automation->wait_duration_unit);
    }

    /**
     * Shared by the automation-level wait (before any action runs) and a
     * mid-sequence "wait" action step — same unit vocabulary, same rounding.
     */
    protected function computeWaitSeconds(?int $value, ?string $unit): int
    {
        if (! $value || $value < 1) {
            return 0;
        }

        return match ($unit) {
            'minutes' => $value * 60,
            'hours' => $value * 3600,
            default => $value * 86400,
        };
    }

    /**
     * Fetch automations from the database.
     *
     * A null $pipelineId (or a null pipeline_id on the automation row) means
     * "any pipeline" — deal automations are no longer required to be scoped
     * to one pipeline. Lead automations never carry a pipeline_id.
     *
     * @param  string  $subjectType  DealAutomation::SUBJECT_DEAL|SUBJECT_LEAD
     * @return \Illuminate\Database\Eloquent\Collection
     */
    protected function getAutomations(?int $pipelineId, ?string $trigger, string $subjectType = DealAutomation::SUBJECT_DEAL)
    {
        if (! AutomationV2Feature::enabled() && $subjectType !== DealAutomation::SUBJECT_DEAL) {
            return DealAutomation::query()->whereRaw('0 = 1')->get();
        }

        return DealAutomation::where('active', true)
            ->where('subject_type', $subjectType)
            ->when($subjectType === DealAutomation::SUBJECT_DEAL, function ($query) use ($pipelineId) {
                if (AutomationV2Feature::usesLegacyDealPipelineScope()) {
                    // Legacy exact match, but keep null pipeline_id rows — they
                    // may have been created under v2 as "all pipelines".
                    $query->where(function ($q) use ($pipelineId) {
                        $q->where('pipeline_id', $pipelineId)->orWhereNull('pipeline_id');
                    });
                } else {
                    $query->where(function ($q) use ($pipelineId) {
                        $q->whereNull('pipeline_id')->orWhere('pipeline_id', $pipelineId);
                    });
                }
            })
            ->where(function ($query) use ($trigger) {
                $query->where('trigger', $trigger)
                    ->orWhereNull('trigger');
            })
            ->orderBy('priority', 'desc') // Higher priority runs first
            ->with(['conditions', 'actions.emailTemplate'])
            ->get();
    }

    /**
     * Evaluate all conditions for a given automation.
     */
    protected function evaluateConditions(Deal|Lead $subject, DealAutomation $automation): bool
    {
        if ($automation->conditions->isEmpty()) {
            return true; // No conditions means it always runs if triggered
        }

        foreach ($automation->conditions as $condition) {
            $fieldValue = $this->fieldResolver->resolve($subject, $condition->field);

            $passed = $this->conditionEvaluator->evaluate(
                $fieldValue,
                $condition
            );

            if (! $passed) {
                return false; // All conditions must pass (AND logic)
            }
        }

        return true;
    }

    /**
     * Execute actions defined in the automation, starting at $resumeFromActionId
     * (inclusive) when resuming a run a "wait" step previously paused — null
     * starts from the first action, matching all pre-existing callers.
     *
     * A "wait" action_type mid-sequence stops execution here and queues a
     * pending run for the next action instead of performing anything itself;
     * the rest of the sequence resumes later via
     * deal-automations:process-pending-runs, same mechanism the automation's
     * own pre-actions wait already uses.
     *
     * @param  string|null  $runId  Continues an execution a wait step paused;
     *                              null starts a new one.
     * @return bool True when the full action list finished; false when a wait
     *              step queued a resume row for later.
     */
    protected function executeActions(Deal|Lead $subject, DealAutomation $automation, ?int $resumeFromActionId = null, ?string $runId = null): bool
    {
        // One id for this whole execution — every step's log row carries it,
        // and a wait step hands it to the pending row so the steps that resume
        // afterwards land in the same run rather than looking like a new one.
        $this->currentRunId = $runId ?: (string) Str::uuid();

        $actions = $automation->actions->sortBy('id')->values();

        $startIndex = 0;
        if ($resumeFromActionId !== null) {
            $found = $actions->search(fn ($a) => $a->id === $resumeFromActionId);
            // Not found means the automation was edited (actions deleted +
            // recreated with new ids) while this subject was mid-wait — fall
            // back to running the current sequence from the top rather than
            // silently dropping the rest. Matches this service's existing
            // philosophy of always operating on current state, never a
            // snapshot (see runPending()'s condition re-check for the same
            // reasoning).
            $startIndex = $found === false ? 0 : $found;
        }

        // Snapshotted before any action runs, not read from $subject after the
        // loop: every performXxx() call above does its own saveQuietly(), and
        // each save() resets Eloquent's wasChanged()/getOriginal() to that
        // save's own delta. An automation with a set_field_value(won) action
        // followed by another action that saves the same subject again (e.g.
        // a second set_field_value, or a stage_transition) would otherwise
        // see wasChanged('outcome_status') already reset to false by that
        // later save, and silently never fire DealWonEvent.
        $wasWonBeforeActions = $subject instanceof Deal
            && $subject->outcome_status === \App\Enums\OutcomeStatus::Won;
        // Don't re-fire for a deal that already went through commission
        // distribution in an earlier run — a *different* concern from
        // is_locked (see ProcessDealWonJob), which lock_deal can set within
        // this very automation without affecting this check at all.
        $wasCommissionLockedBeforeActions = $subject instanceof Deal && (bool) $subject->commission_locked;

        // NOTE: A general rule of thumb should be that actions should save quietly, so that there is no recursive loop
        for ($i = $startIndex; $i < $actions->count(); $i++) {
            $action = $actions[$i];

            if (($action->action_type ?? null) === 'wait') {
                if (! AutomationV2Feature::enabled()) {
                    continue;
                }

                $waitSeconds = $this->computeWaitSeconds($action->wait_duration_value, $action->wait_duration_unit);
                $nextAction = $actions->get($i + 1);

                if ($waitSeconds > 0 && $nextAction) {
                    $this->queueResume($subject, $automation, $nextAction->id, $waitSeconds, $this->currentRunId);
                    $this->logAction(
                        $subject,
                        $automation,
                        "Waiting {$action->wait_duration_value} {$action->wait_duration_unit} before continuing",
                        DealAutomationLog::STATUS_SUCCESS,
                        'wait',
                    );

                    return false; // remaining actions resume later
                }

                continue; // no wait configured, or nothing left after it — no-op, keep going
            }

            $this->performAction($subject, $action, $automation);
        }

        if (! ($subject instanceof Deal)) {
            return true;
        }

        // After the actions we then emit the necessary events, such as mlm engine DealWonEvent. This is because we save the dealModel quietly to avoid cascades because we do support an array of actions that will cannot afford to trigger the deal observer as this will lead to recursive updates ...
        // MLM: Fire DealWonEvent when outcome_status changes to 'won' — judged
        // against the snapshots taken before any action ran (see above), not
        // against $subject's live wasChanged(), which a later action in this
        // same sequence (another set_field_value, a stage_transition) may
        // have already overwritten.
        if (! $wasWonBeforeActions && $subject->outcome_status === \App\Enums\OutcomeStatus::Won && ! $wasCommissionLockedBeforeActions) {
            $this->fireDealWonEvent($subject);
        }

        return true;
    }

    /**
     * Queue a pending run resuming at $resumeActionId — used when a "wait"
     * action step is hit mid-sequence. updateOrCreate refreshes run_at and
     * resume_action_id when the same subject is already waiting.
     *
     * $runId carries the paused execution across the wait so its remaining
     * steps log under the same run as the ones that already ran.
     */
    protected function queueResume(Deal|Lead $subject, DealAutomation $automation, int $resumeActionId, int $waitSeconds, ?string $runId = null): void
    {
        try {
            DealAutomationPendingRun::updateOrCreate([
                'deal_automation_id' => $automation->id,
                'subject_type' => $subject instanceof Lead ? DealAutomation::SUBJECT_LEAD : DealAutomation::SUBJECT_DEAL,
                'subject_id' => $subject->id,
            ], [
                'company_id' => $subject->company_id,
                'resume_action_id' => $resumeActionId,
                'run_id' => $runId,
                'run_at' => now()->addSeconds($waitSeconds),
            ]);
        } catch (\Exception $e) {
            Log::error("Failed to queue automation resume '{$automation->name}' (ID: {$automation->id})", [
                'subject_type' => $subject instanceof Lead ? 'lead' : 'deal',
                'subject_id' => $subject->id,
                'resume_action_id' => $resumeActionId,
                'exception' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Fire DealWonEvent when outcome_status is set to won.
     * Triggered by automation setting outcome_status = 'won', not by pipeline stage.
     */
    private function fireDealWonEvent(Deal $deal): void
    {
        try {
            $agent = $deal->leadAgent;

            if ($agent) {
                event(new DealWonEvent($deal, $agent));

                Log::info('DealWonEvent fired', [
                    'deal_id' => $deal->id,
                    'agent_id' => $agent->id,
                ]);
            } else {
                Log::warning('DealWonEvent not fired: no agent assigned', [
                    'deal_id' => $deal->id,
                ]);
            }
        } catch (\Exception $e) {
            Log::error('Failed to fire DealWonEvent', [
                'deal_id' => $deal->id,
                'exception' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Perform a single action on the subject.
     *
     * Supports action types:
     * - stage_transition (default/legacy, deal only): Move deal to target stage/pipeline
     * - set_field_value: Set a field on the deal/lead to a specific value
     * - lock_deal (deal only): Lock the deal and set locked_at timestamp
     * - send_email: Send an email template to the deal's lead / the lead itself
     *
     * @param  \App\Models\DealAutomationAction  $action
     */
    protected function performAction(Deal|Lead $subject, $action, ?DealAutomation $automation = null): void
    {
        $actionType = $action->action_type ?? 'stage_transition';

        if (! AutomationV2Feature::supportsActionType($actionType)) {
            Log::info("Skipping action type '{$actionType}' — automation v2 is disabled.");

            return;
        }

        if ($subject instanceof Lead) {
            match ($actionType) {
                'set_field_value' => $this->performSetFieldValue($subject, $action, $automation),
                'send_email' => $this->performSendEmail($subject, $action, $automation),
                'create_task' => $this->performCreateTask($subject, $action, $automation),
                'create_note' => $this->performCreateNote($subject, $action, $automation),
                'meta_conversion' => $this->performMetaConversion($subject, $action, $automation),
                default => Log::warning("Action type '{$actionType}' is not supported for lead automations (Lead ID: {$subject->id})."),
            };

            return;
        }

        match ($actionType) {
            'set_field_value' => $this->performSetFieldValue($subject, $action, $automation),
            'lock_deal' => $this->performLockDeal($subject, $action, $automation),
            'send_email' => $this->performSendEmail($subject, $action, $automation),
            'create_task' => $this->performCreateTask($subject, $action, $automation),
            'create_note' => $this->performCreateNote($subject, $action, $automation),
            'meta_conversion' => $this->performMetaConversion($subject, $action, $automation),
            default => $this->performStageTransition($subject, $action, $automation),
        };
    }

    /**
     * Perform a stage transition action (legacy behavior, deal only).
     */
    protected function performStageTransition(Deal $deal, $action, ?DealAutomation $automation = null): void
    {
        $targetStageId = $action->target_stage_id;
        $targetPipelineId = $action->target_pipeline_id ?? $deal->lead_pipeline_id;
        $forwardOnly = $action->forward_only;

        $shouldUpdate = true;

        if ($forwardOnly) {
            // If staying in the same pipeline, check stage priority
            if ($targetPipelineId == $deal->lead_pipeline_id) {
                $currentStage = $this->getStage($deal->pipeline_stage_id);
                $targetStage = $this->getStage($targetStageId);

                if ($currentStage && $targetStage) {
                    if ($targetStage->priority <= $currentStage->priority) {
                        $shouldUpdate = false;
                        Log::info("Skipping action for Deal ID: {$deal->id}. Forward only rule prevented move from {$currentStage->name} (Priority: {$currentStage->priority}) to {$targetStage->name} (Priority: {$targetStage->priority}).");
                    }
                }
            }
        }

        if ($shouldUpdate) {
            $originalStageId = $deal->pipeline_stage_id;
            $originalPipelineId = $deal->lead_pipeline_id;
            $changes = [];
            if ($deal->pipeline_stage_id != $targetStageId) {
                $deal->pipeline_stage_id = $targetStageId;
                $changes[] = "Stage changed to ID: {$targetStageId}";
            }

            if ($deal->lead_pipeline_id != $targetPipelineId) {
                $deal->lead_pipeline_id = $targetPipelineId;
                $changes[] = "Pipeline changed to ID: {$targetPipelineId}";
            }

            if (! empty($changes)) {
                // saveQuietly skips DealObserver (deliberately — it stops
                // automations cascading), but the observer is also what stamps
                // the stage dwell clock, so set it here. The crm_event is
                // recorded explicitly below, so that half is already covered.
                if ($originalStageId != $targetStageId) {
                    $deal->stage_entered_at = now();
                }

                $deal->saveQuietly(); // Bypass observer to prevent cascading
                $description = 'Stage transition: '.implode(', ', $changes);
                Log::info("Action executed for Deal ID: {$deal->id}. ".implode(', ', $changes));
                $this->logAction($deal, $automation, $description, DealAutomationLog::STATUS_SUCCESS, 'stage');

                // Record CRM events for automation-driven changes
                if ($originalStageId != $targetStageId) {
                    $fromStage = $this->getStage($originalStageId);
                    $toStage = $this->getStage($targetStageId);

                    $this->recordCrmEvent('deal_stage_changed', $deal, [
                        'generation_type' => 'system_generated',
                        'metadata' => [
                            'from_stage' => $fromStage?->name,
                            'to_stage' => $toStage?->name,
                            'from_stage_id' => $originalStageId,
                            'to_stage_id' => $targetStageId,
                            'automation_id' => $automation?->id,
                            'automation_name' => $automation?->name,
                        ],
                    ]);

                    // Fire win/lost events when automation moves deal to terminal stages
                    if ($toStage && $toStage->slug === 'win') {
                        $this->recordCrmEvent('deal_closed_won', $deal, [
                            'generation_type' => 'system_generated',
                            'metadata' => ['stage_id' => $targetStageId, 'stage_name' => $toStage->name, 'automation_id' => $automation?->id],
                        ]);
                    } elseif ($toStage && $toStage->slug === 'lost') {
                        $this->recordCrmEvent('deal_closed_lost', $deal, [
                            'generation_type' => 'system_generated',
                            'metadata' => ['stage_id' => $targetStageId, 'stage_name' => $toStage->name, 'automation_id' => $automation?->id],
                        ]);
                    }
                }

                if ($originalPipelineId != $targetPipelineId) {
                    $this->recordCrmEvent('deal_pipeline_changed', $deal, [
                        'generation_type' => 'system_generated',
                        'metadata' => [
                            'from_pipeline_id' => $originalPipelineId,
                            'to_pipeline_id' => $targetPipelineId,
                            'automation_id' => $automation?->id,
                            'automation_name' => $automation?->name,
                        ],
                    ]);
                }
            }
        }
    }

    /**
     * Perform a set_field_value action against the deal or lead.
     */
    protected function performSetFieldValue(Deal|Lead $subject, $action, ?DealAutomation $automation = null): void
    {
        $fieldName = $action->field_name;
        $fieldValue = $action->field_value;
        $label = $subject instanceof Lead ? "Lead ID: {$subject->id}" : "Deal ID: {$subject->id}";

        if (! $fieldName) {
            Log::warning("SetFieldValue action missing field_name for {$label}");

            return;
        }

        $subject->{$fieldName} = $fieldValue;
        $subject->saveQuietly(); // Bypass observer to prevent cascading

        $description = "Set {$fieldName} = {$fieldValue}";
        Log::info("Action executed for {$label}. {$description}");
        $this->logAction($subject, $automation, $description, DealAutomationLog::STATUS_SUCCESS, 'field');

        // Record CRM event for automation-driven field change
        $this->recordCrmEvent($subject instanceof Lead ? 'lead_updated' : 'deal_updated', $subject, [
            'generation_type' => 'system_generated',
            'metadata' => [
                'field_name' => $fieldName,
                'field_value' => $fieldValue,
                'automation_id' => $automation?->id,
                'automation_name' => $automation?->name,
            ],
        ]);
    }

    /**
     * Perform a lock_deal action (deal only).
     */
    protected function performLockDeal(Deal $deal, $action, ?DealAutomation $automation = null): void
    {
        $deal->is_locked = true;
        $deal->locked_at = now();
        $deal->saveQuietly(); // Bypass observer to prevent cascading

        $description = 'Deal locked';
        Log::info("Action executed for Deal ID: {$deal->id}. {$description}");
        $this->logAction($deal, $automation, $description, DealAutomationLog::STATUS_SUCCESS, 'lock');

        // Record CRM event for automation-driven deal lock
        $this->recordCrmEvent('deal_updated', $deal, [
            'generation_type' => 'system_generated',
            'status' => 'completed',
            'metadata' => [
                'action' => 'deal_locked',
                'automation_id' => $automation?->id,
                'automation_name' => $automation?->name,
            ],
        ]);
    }

    /**
     * Perform a send_email action: resolve every recipient the action's
     * checkboxes target (client/agent/watchers/participants/team/lead owner/
     * referring agent/specific users/custom addresses — any combination),
     * render the linked template's subject/body once, then email each
     * resolved address individually (never exposing one recipient to another).
     */
    protected function performSendEmail(Deal|Lead $subject, $action, ?DealAutomation $automation = null): void
    {
        $template = $action->emailTemplate;
        $label = $subject instanceof Lead ? "Lead ID: {$subject->id}" : "Deal ID: {$subject->id}";

        if (! $template) {
            Log::warning("SendEmail action missing email template for {$label}");
            $this->logAction($subject, $automation, 'Email skipped: template not found', DealAutomationLog::STATUS_SKIPPED, 'email');

            return;
        }

        $recipients = $this->resolveEmailRecipients($subject, $action);

        if (empty($recipients)) {
            Log::warning("SendEmail action skipped for {$label}. No recipients resolved.");
            $this->logAction($subject, $automation, 'Email skipped: no recipients resolved', DealAutomationLog::STATUS_SKIPPED, 'email');
            $this->recordAutomationOutcomeEvent($subject, $automation, false, [
                'action' => 'automation_email_failed',
                'comment' => 'Automation email skipped: no recipients resolved',
            ]);

            return;
        }

        $variableMap = $template->variableMappingConfig();

        $subjectLine = $this->renderTemplateText($subject, $template->subject, $variableMap);
        $body = $this->renderTemplateText($subject, $template->body, $variableMap);
        $preheaderText = $this->renderPlainTemplateText($subject, $template->preheader, $variableMap);

        $plunkTemplateId = $template->plunk_template_id;
        $plunkVariables = [];
        if (! empty($plunkTemplateId)) {
            // Explicit mappings always ship as Plunk variables — even ones never
            // referenced in Subject/Body, since the Plunk template body lives in
            // Plunk's dashboard and isn't visible here.
            $plunkVariables = $this->buildPlunkVariables($subject, [$template->subject, $template->body, $template->preheader], $variableMap);
            foreach (array_keys($variableMap) as $variable) {
                if (! array_key_exists($variable, $plunkVariables)) {
                    $plunkVariables[$variable] = $this->resolveTagValue($subject, $variable, $variableMap);
                }
            }
            $plunkVariables['subject'] = $subjectLine;
            $plunkVariables['body'] = $body;
            $plunkVariables['preheader'] = $preheaderText;
            $plunkVariables['appName'] = config('app.name');
            $plunkVariables['currentYear'] = (string) date('Y');
        }

        $sent = [];
        $failed = [];
        // One entry per recipient describing which mail system actually
        // delivered it (UNS/Plunk or the PHP SMTP mailer) and what that
        // system answered — stored on the log row so a failure can be
        // diagnosed from Run History without server log access.
        $deliveries = [];

        foreach ($recipients as $recipient) {
            $correlationId = (string) Str::uuid();

            $deliveryContext = [
                'source' => 'deal_automation',
                'correlation_id' => $correlationId,
                'company_id' => $subject->company_id,
                'automation_id' => $automation?->id,
                'automation_name' => $automation?->name,
                'deal_id' => $subject instanceof Deal ? $subject->id : null,
                'lead_id' => $subject instanceof Lead ? $subject->id : null,
                'template_id' => $template->id,
                'template_name' => $template->name,
            ];

            try {
                Mail::to($recipient)->send(new DealAutomationTemplateEmail($subjectLine, $body, $preheaderText, $plunkTemplateId, $plunkVariables, $deliveryContext));
                $sent[] = $recipient;
                $deliveries[] = $this->describeDelivery($recipient, $correlationId, null);
            } catch (\Exception $e) {
                $failed[$recipient] = $e->getMessage();
                $deliveries[] = $this->describeDelivery($recipient, $correlationId, $e->getMessage());
                Log::error("Failed to send automation email to {$recipient} for {$label}", [
                    'exception' => $e->getMessage(),
                ]);
            }
        }

        $descriptionParts = [];
        if (! empty($sent)) {
            $descriptionParts[] = (! empty($plunkTemplateId) ? "via Plunk ({$plunkTemplateId}) " : '').'to: '.implode(', ', $sent);
        }
        if (! empty($failed)) {
            $descriptionParts[] = 'failed: '.implode(', ', array_keys($failed));
        }
        $description = "Email using template \"{$template->name}\" — ".implode('; ', $descriptionParts);

        Log::info("Action executed for {$label}. {$description}");
        $this->logAction($subject, $automation, $description, empty($failed) ? DealAutomationLog::STATUS_SUCCESS : DealAutomationLog::STATUS_FAILED, 'email', [
            'template_id' => $template->id,
            'template_name' => $template->name,
            'plunk_template_id' => $plunkTemplateId,
            'subject' => $subjectLine,
            'deliveries' => $deliveries,
        ]);

        $this->recordAutomationOutcomeEvent($subject, $automation, ! empty($sent), [
            'action' => empty($failed) ? 'automation_email_sent' : 'automation_email_partial_failure',
            'comment' => $description,
            'template_id' => $template->id,
            'template_name' => $template->name,
            'sent_to' => $sent,
            'failed_for' => array_keys($failed),
        ]);
    }

    /**
     * Turn one recipient's send into the diagnostic record kept on the
     * automation log: which system delivered it, whether UNS was tried first,
     * and whatever that system (or the thrown exception) said about it.
     *
     * The outcome comes from MailDeliveryRecorder, which UnsRoutingTransport
     * fills in during the synchronous Mail::send() above. If it's missing —
     * e.g. a mail driver that never reaches the transport, like the array
     * driver in tests — the record degrades to 'unknown'/'unconfirmed' rather
     * than claiming a delivery nothing actually confirmed.
     *
     * @return array<string, mixed>
     */
    protected function describeDelivery(string $recipient, string $correlationId, ?string $exceptionMessage): array
    {
        $outcome = $this->mailDeliveryRecorder->pull($correlationId);

        return [
            'recipient' => $recipient,
            // Ties this line to its email_delivery_logs row.
            'correlation_id' => $correlationId,
            'status' => $exceptionMessage !== null
                ? EmailDeliveryLog::STATUS_FAILED
                : ($outcome['status'] ?? EmailDeliveryLog::STATUS_UNCONFIRMED),
            'system' => $outcome['system'] ?? 'unknown',
            'uns_attempted' => (bool) ($outcome['uns_attempted'] ?? false),
            'response_status' => $outcome['response_status'] ?? null,
            'response_body' => $outcome['response_body'] ?? null,
            'fallback_reason' => $outcome['fallback_reason'] ?? null,
            'error' => $exceptionMessage ?? ($outcome['error'] ?? null),
        ];
    }

    /**
     * Resolve a send_email action's checkbox selections into a deduplicated
     * list of email addresses. Falls back to ['client'] when recipient_types
     * isn't set, so send_email actions created before this feature keep
     * their original "email the lead" behavior unchanged.
     *
     * @return string[]
     */
    protected function resolveEmailRecipients(Deal|Lead $subject, $action): array
    {
        $types = $action->recipient_types ?: ['client'];
        $emails = [];

        foreach ($types as $type) {
            match ($type) {
                'client' => $this->pushEmail($emails, $this->resolveLeadFor($subject)?->client_email),
                'deal_agent' => $subject instanceof Deal
                    ? $this->pushEmail($emails, $subject->loadMissing('leadAgent.user')->leadAgent?->user?->email)
                    : null,
                'deal_watchers' => $subject instanceof Deal
                    ? $this->pushEmails($emails, $subject->loadMissing('dealWatchers')->dealWatchers->pluck('email')->all())
                    : null,
                'deal_participants' => $subject instanceof Deal
                    ? $this->pushEmails($emails, $subject->loadMissing('dealParticipants')->dealParticipants->pluck('email')->all())
                    : null,
                'deal_team' => $subject instanceof Deal
                    ? $this->pushEmails($emails, $this->resolveDealTeamEmails($subject))
                    : null,
                'lead_owner' => $this->pushEmail($emails, $this->resolveLeadFor($subject)?->leadOwner?->email),
                'referred_by_agent' => $this->pushEmail($emails, $this->resolveLeadFor($subject)?->referredByAgent?->user?->email),
                'specific_user' => $this->pushEmails($emails, User::whereIn('id', $action->recipient_user_ids ?? [])->pluck('email')->all()),
                'custom_email' => $this->pushEmails($emails, $this->parseCustomEmails($action->recipient_emails)),
                default => null,
            };
        }

        return array_values(array_unique($emails));
    }

    /**
     * "Deal Team" — this codebase's own documented convention for full
     * read/write deal access is agent + participants (see Deal::dealParticipants()
     * vs the view-only dealWatchers()); there's no separate "team" model.
     *
     * @return string[]
     */
    protected function resolveDealTeamEmails(Deal $deal): array
    {
        $deal->loadMissing(['leadAgent.user', 'dealParticipants']);

        $emails = [];
        $this->pushEmail($emails, $deal->leadAgent?->user?->email);
        $this->pushEmails($emails, $deal->dealParticipants->pluck('email')->all());

        return $emails;
    }

    /**
     * The Lead behind this automation's subject — itself for a lead-subject
     * automation, or the deal's linked contact for a deal-subject one.
     */
    protected function resolveLeadFor(Deal|Lead $subject): ?Lead
    {
        if ($subject instanceof Lead) {
            return $subject;
        }

        return $subject->loadMissing('contact')->contact;
    }

    /**
     * Split a free-typed recipient_emails string on commas/semicolons/newlines
     * and keep only tokens that pass FILTER_VALIDATE_EMAIL — malformed entries
     * are silently dropped rather than blocking the whole action.
     *
     * @return string[]
     */
    protected function parseCustomEmails(?string $raw): array
    {
        if (empty($raw)) {
            return [];
        }

        $tokens = preg_split('/[,;\r\n]+/', $raw) ?: [];

        return array_values(array_filter(array_map('trim', $tokens), fn ($email) => filter_var($email, FILTER_VALIDATE_EMAIL) !== false));
    }

    /**
     * @param  string[]  $emails
     */
    protected function pushEmail(array &$emails, ?string $email): void
    {
        if (! empty($email)) {
            $emails[] = $email;
        }
    }

    /**
     * @param  string[]  $emails
     * @param  array<int, string|null>  $newEmails
     */
    protected function pushEmails(array &$emails, array $newEmails): void
    {
        foreach ($newEmails as $email) {
            $this->pushEmail($emails, $email);
        }
    }

    /**
     * Perform a create_task action: create a task on the deal/lead, assigned
     * to either a specific user or "the lead owner" (resolved at execution
     * time), attributed to a resolved "assigner" as its added_by/created_by.
     */
    protected function performCreateTask(Deal|Lead $subject, $action, ?DealAutomation $automation = null): void
    {
        $label = $subject instanceof Lead ? "Lead ID: {$subject->id}" : "Deal ID: {$subject->id}";

        $title = $this->renderPlainTemplateText($subject, $action->title) ?: 'Automated Task';
        $description = $this->renderPlainTemplateText($subject, $action->content);

        $assigneeUserId = $this->resolveAutomationUserId($subject, $action->assignee_type, $action->assignee_user_id);
        $assignerUserId = $this->resolveAutomationUserId($subject, $action->assigner_type, $action->assigner_user_id);
        $assigner = $assignerUserId ? User::find($assignerUserId) : null;

        $dueDate = $this->resolveTaskDueDate($action);

        try {
            $task = app(\App\Services\TaskService::class)->createTask([
                'heading' => $title,
                'description' => $description,
                'user_ids' => $assigneeUserId ? [$assigneeUserId] : [],
                'taskable_type' => $subject instanceof Lead ? 'lead' : 'deal',
                'taskable_id' => $subject->id,
                'due_date' => $dueDate,
            ], $assigner);

            $task->integration_origin = IntegrationOrigin::SYSTEM->value;
            $task->save();

            $description2 = "Task created: \"{$title}\"".($assigneeUserId ? " (assigned to user #{$assigneeUserId})" : '');
            Log::info("Action executed for {$label}. {$description2}");
            $this->logAction($subject, $automation, $description2, DealAutomationLog::STATUS_SUCCESS, 'task');

            // No success CRM event recorded here on purpose — TaskService::createTask()
            // already records its own "Task added" event as a side effect of the
            // creation itself (recordTaskCreated()/'task_added' metadata), and this
            // runs on a real (non-quiet) save so that event fires normally. Adding
            // a second "Task created by automation" event here duplicated every
            // automation-created task in the CRM timeline.
        } catch (\Exception $e) {
            Log::error("Failed to create automation task for {$label}", [
                'exception' => $e->getMessage(),
            ]);
            $this->logAction($subject, $automation, "Task creation failed: {$e->getMessage()}", DealAutomationLog::STATUS_FAILED, 'task');

            $this->recordAutomationOutcomeEvent($subject, $automation, false, [
                'action' => 'automation_task_creation_failed',
                'comment' => "Automation failed to create task: {$e->getMessage()}",
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Compute a create_task action's due date from its configured delta +
     * optional time-of-day override. The delta is measured from now — the
     * moment the automation actually creates the task — not from the
     * triggering deal/lead's own created_at. Returns null (no due date,
     * matching the pre-existing default behavior) when no delta is set.
     *
     * Formatted per company()->date_format/time_format since that's the
     * string format TaskService::createTask() parses 'due_date' with.
     */
    protected function resolveTaskDueDate($action): ?string
    {
        if ($action->due_date_delta_value === null) {
            return null;
        }

        $due = match ($action->due_date_delta_unit ?? 'days') {
            'minutes' => now()->addMinutes($action->due_date_delta_value),
            'hours' => now()->addHours($action->due_date_delta_value),
            default => now()->addDays($action->due_date_delta_value),
        };

        if (! empty($action->due_time)) {
            $time = \Carbon\Carbon::parse($action->due_time);
            $due->setTime($time->hour, $time->minute, $time->second);
        }

        return $due->format(
            (company()?->date_format ?? 'Y-m-d').' '.(company()?->time_format ?? 'H:i')
        );
    }

    /**
     * Perform a create_note action: create a note on the deal/lead, attributed
     * to a resolved "assigner" as its added_by.
     */
    protected function performCreateNote(Deal|Lead $subject, $action, ?DealAutomation $automation = null): void
    {
        $label = $subject instanceof Lead ? "Lead ID: {$subject->id}" : "Deal ID: {$subject->id}";

        $title = $this->renderPlainTemplateText($subject, $action->title);
        $details = $this->renderPlainTemplateText($subject, $action->content);

        if (empty($details)) {
            Log::warning("CreateNote action missing content for {$label}");
            $this->logAction($subject, $automation, 'Note skipped: no content', DealAutomationLog::STATUS_SKIPPED, 'note');

            return;
        }

        $authorUserId = $this->resolveAutomationUserId($subject, $action->assigner_type, $action->assigner_user_id);

        try {
            if ($subject instanceof Lead) {
                $note = new LeadNote;
                $note->lead_id = $subject->id;
            } else {
                $note = new DealNote;
                $note->deal_id = $subject->id;
            }

            $note->title = $title !== '' ? $title : null;
            $note->details = $details;
            $note->added_by = $authorUserId;
            $note->integration_origin = IntegrationOrigin::SYSTEM->value;
            $note->save();

            $description = 'Note created'.($title !== '' ? ": \"{$title}\"" : '');
            Log::info("Action executed for {$label}. {$description}");
            $this->logAction($subject, $automation, $description, DealAutomationLog::STATUS_SUCCESS, 'note');

            // Deal notes get a "Note added" CRM event for free from
            // DealNoteObserver::created() as a side effect of this (non-quiet)
            // save — but ONLY when it's not running in console and a user()
            // is present (its own gate: `if (!isRunningInConsoleOrSeeding())
            // { if (user()) {...} }`). That's true for an immediate automation
            // firing inside a real web request, but NOT for one resumed by
            // deal-automations:process-pending-runs / process-date-triggers
            // (both run via artisan, i.e. console) — so this only skips the
            // redundant event when we know the observer's will actually fire;
            // otherwise it's the only thing that logs the note at all.
            // LeadNoteObserver has no CRM-event equivalent in any context (it
            // only sends notifications), so lead notes always need this event.
            $dealObserverWillLogIt = $subject instanceof Deal && ! isRunningInConsoleOrSeeding() && user();

            if ($subject instanceof Lead || ! $dealObserverWillLogIt) {
                $this->recordAutomationOutcomeEvent($subject, $automation, true, [
                    'action' => 'automation_note_created',
                    'comment' => 'Note added by automation: '.($title !== '' ? $title : 'Untitled'),
                    'note_id' => $note->id,
                    'note_title' => $note->title,
                ], $subject instanceof Lead ? 'lead_note_added' : 'deal_note_added');
            }
        } catch (\Exception $e) {
            Log::error("Failed to create automation note for {$label}", [
                'exception' => $e->getMessage(),
            ]);
            $this->logAction($subject, $automation, "Note creation failed: {$e->getMessage()}", DealAutomationLog::STATUS_FAILED, 'note');

            $this->recordAutomationOutcomeEvent($subject, $automation, false, [
                'action' => 'automation_note_creation_failed',
                'comment' => "Automation failed to create note: {$e->getMessage()}",
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Perform a meta_conversion action: queue a Meta (Facebook) Conversions
     * API event for the deal/lead. Event name supports merge tags (e.g. a
     * lead field), value is optional and defaults to 0. Actually sending is
     * backgrounded via SendMetaConversionEventJob — MetaConversionsService
     * fails soft (returns false, never throws) so a misconfigured/rejected
     * Meta account can't break the rest of the automation's actions.
     */
    protected function performMetaConversion(Deal|Lead $subject, $action, ?DealAutomation $automation = null): void
    {
        $label = $subject instanceof Lead ? "Lead ID: {$subject->id}" : "Deal ID: {$subject->id}";

        $eventName = $this->renderPlainTemplateText($subject, $action->meta_event_name);

        if ($eventName === '') {
            Log::warning("MetaConversion action missing event name for {$label}");
            $this->logAction($subject, $automation, 'Meta Conversion skipped: no event name', DealAutomationLog::STATUS_SKIPPED, 'meta');

            return;
        }

        $value = (float) ($action->meta_event_value ?? 0);

        // The job's own ->afterCommit() only defers via the queue connection's
        // enqueueUsing() — QUEUE_CONNECTION=sync bypasses that entirely and
        // fires immediately (see SyncQueue::push()), so it would still run
        // inside an open DB::transaction(). DB::afterCommit() defers at the
        // connection/transaction-manager level instead, which works under
        // every queue driver including sync, and fires immediately here if no
        // transaction is open.
        $origin = [
            'source' => 'automation',
            'automation_id' => $automation?->id,
            'automation_name' => $automation?->name,
            // So the outcome row the job writes later joins this same run
            // rather than appearing as a run of its own.
            'run_id' => $this->currentRunId,
        ];

        DB::afterCommit(function () use ($subject, $eventName, $value, $origin) {
            \App\Jobs\SendMetaConversionEventJob::dispatch($subject, $eventName, $value, $origin);
        });

        $description = "Meta Conversion event queued: \"{$eventName}\"".($value > 0 ? " (value: {$value})" : '');
        Log::info("Action executed for {$label}. {$description}");
        // The queue-time row only records that the action fired. The job writes
        // a second 'meta' row once Meta has actually answered — that's the one
        // carrying the failure reason.
        $this->logAction($subject, $automation, $description, DealAutomationLog::STATUS_SUCCESS, 'meta', [
            'stage' => 'queued',
            'event_name' => $eventName,
            'value' => $value,
        ]);

        $this->recordAutomationOutcomeEvent($subject, $automation, true, [
            'action' => 'automation_meta_conversion_queued',
            'comment' => "Meta Conversion event queued by automation: {$eventName}",
            'meta_event_name' => $eventName,
            'meta_event_value' => $value,
        ]);
    }

    /**
     * Resolve who a create_task/create_note action's assignee/assigner should
     * be: a specific configured user, or the lead's owner (hopping through
     * Deal->contact for a deal-subject automation). Falls back to the first
     * company admin so task/note creation never fails for lack of an actor.
     */
    protected function resolveAutomationUserId(Deal|Lead $subject, ?string $type, ?int $specificUserId): ?int
    {
        if ($type === 'specific_user' && $specificUserId) {
            return $specificUserId;
        }

        if ($type === 'lead_owner') {
            $lead = $subject instanceof Lead ? $subject : ($subject->relationLoaded('contact') ? $subject->contact : $subject->load('contact')->contact);

            if ($lead?->lead_owner) {
                return (int) $lead->lead_owner;
            }
        }

        $admin = User::allAdmins($subject->company_id)->first();

        return $admin?->id;
    }

    /**
     * Record a create_task/create_note outcome (success or failure) to the
     * CRM event timeline for the deal/lead, so it shows up in its activity
     * feed alongside manually-created records — not just the automation log.
     *
     * @param  array<string, mixed>  $metadata
     */
    protected function recordAutomationOutcomeEvent(Deal|Lead $subject, ?DealAutomation $automation, bool $success, array $metadata, ?string $successSlug = null): void
    {
        $slug = $success && $successSlug ? $successSlug : ($subject instanceof Lead ? 'lead_updated' : 'deal_updated');

        $this->recordCrmEvent($slug, $subject, [
            'generation_type' => 'system_generated',
            'status' => $success ? 'completed' : 'failed',
            'metadata' => array_merge($metadata, [
                'automation_id' => $automation?->id,
                'automation_name' => $automation?->name,
            ]),
        ]);
    }

    /**
     * Same merge-tag substitution as renderTemplateText(), but unescaped —
     * for task/note titles and content, which aren't rendered as HTML.
     */
    protected function renderPlainTemplateText(Deal|Lead $subject, ?string $text, array $variableMap = []): string
    {
        if (empty($text)) {
            return '';
        }

        return preg_replace_callback('/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/', function ($matches) use ($subject, $variableMap) {
            return $this->resolveTagValue($subject, $matches[1], $variableMap);
        }, $text);
    }

    /**
     * Resolve every {{tag}} referenced in the given texts into a flat
     * name => value map for Plunk template variables (unescaped — these
     * are JSON payload values, not HTML, unlike renderTemplateText()).
     *
     * @param  string[]  $texts
     * @param  array<string, array<string, mixed>>  $variableMap  EmailTemplate::variableMappingConfig()
     * @return array<string, string>
     */
    protected function buildPlunkVariables(Deal|Lead $subject, array $texts, array $variableMap = []): array
    {
        $variables = [];

        foreach ($texts as $text) {
            if (empty($text)) {
                continue;
            }

            preg_match_all('/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/', $text, $matches);

            foreach ($matches[1] as $tag) {
                if (array_key_exists($tag, $variables)) {
                    continue;
                }

                $variables[$tag] = $this->resolveTagValue($subject, $tag, $variableMap);
            }
        }

        return $variables;
    }

    /**
     * Replace {{tag}} merge tags with resolved values. A tag first checks
     * $variableMap (EmailTemplate::variableMappingConfig() — an explicit
     * "variable name" => field-or-CTA-URL mapping the user configured), then
     * falls back to treating the tag itself as a field key, resolved via
     * FieldResolverService (the same resolver/field keys automation conditions
     * use). Resolved values are HTML-escaped since they may contain
     * user-entered data; the surrounding template markup is left untouched.
     *
     * @param  array<string, array<string, mixed>>  $variableMap
     */
    protected function renderTemplateText(Deal|Lead $subject, ?string $text, array $variableMap = []): string
    {
        if (empty($text)) {
            return '';
        }

        return preg_replace_callback('/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/', function ($matches) use ($subject, $variableMap) {
            return e($this->resolveTagValue($subject, $matches[1], $variableMap));
        }, $text);
    }

    /**
     * Resolve one {{tag}} to a string value. $variableMap[$tag] wins if
     * present — either a 'field' mapping (resolved via FieldResolverService)
     * or a 'cta_url' mapping (resolved via resolveCtaUrl()) — else $tag is
     * resolved as a field key directly.
     *
     * @param  array<string, array<string, mixed>>  $variableMap
     */
    protected function resolveTagValue(Deal|Lead $subject, string $tag, array $variableMap): string
    {
        $mapping = $variableMap[$tag] ?? null;

        if (is_array($mapping) && ($mapping['type'] ?? 'field') === 'cta_url') {
            return $this->resolveCtaUrl($subject, $mapping) ?? '';
        }

        $fieldKey = is_array($mapping) ? ($mapping['field'] ?? $tag) : $tag;

        // Outbound gate. Every merge tag in the system funnels through here —
        // email bodies/subjects, Plunk variables, CTA URLs, task/note text,
        // Meta event names — so blocking here covers a hand-typed tag and a
        // directly-POSTed variable mapping too, not just what the pickers
        // offer. See AutomationFieldCatalog::LEAD_MARKETING_CONDITION_ONLY_FIELDS.
        if (AutomationFieldCatalog::isOutboundBlockedField($fieldKey)) {
            Log::warning('[DealAutomationService] Blocked a merge tag resolving to a restricted marketing identifier.', [
                'tag' => $tag,
                'field' => $fieldKey,
                'subject_type' => $subject instanceof Lead ? 'lead' : 'deal',
                'subject_id' => $subject->id,
            ]);

            return '';
        }

        $value = $this->fieldResolver->resolve($subject, $fieldKey);

        if ($value instanceof \Carbon\Carbon) {
            $value = $value->toDateTimeString();
        } elseif (is_array($value)) {
            $value = implode(', ', $value);
        }

        return (string) ($value ?? '');
    }

    /**
     * Resolve a 'cta_url' variable mapping to an actual link:
     * - 'record': the automation's own subject — Deal or Lead, whichever it is.
     * - 'deal': the Deal specifically (null for a lead-subject automation —
     *   a lead isn't tied to exactly one deal, so there's nothing to link to).
     * - 'lead': the underlying Lead/contact (via resolveLeadFor()).
     * - 'custom': a typed URL, merge-tags resolved (unescaped — same as any
     *   other CTA URL target; renderTemplateText() escapes it once for HTML).
     *
     * @param  array<string, mixed>  $mapping
     */
    protected function resolveCtaUrl(Deal|Lead $subject, array $mapping): ?string
    {
        $target = $mapping['cta_target'] ?? 'record';

        return match ($target) {
            'record' => $subject instanceof Lead ? $this->buildLeadUrl($subject) : $this->buildDealUrl($subject),
            'deal' => $subject instanceof Deal ? $this->buildDealUrl($subject) : null,
            'lead' => ($lead = $this->resolveLeadFor($subject)) ? $this->buildLeadUrl($lead) : null,
            'custom' => $this->renderPlainTemplateText($subject, $mapping['cta_custom_url'] ?? null) ?: null,
            default => null,
        };
    }

    /**
     * Absolute URL to a Deal's detail page, rewritten for the company's own
     * domain when white-labeled (getDomainSpecificUrl() no-ops otherwise —
     * see app/Helper/start.php — same mechanism app/Notifications/* use).
     */
    protected function buildDealUrl(Deal $deal): string
    {
        return getDomainSpecificUrl(route('deals.show', $deal->id), $deal->company);
    }

    /**
     * Absolute URL to a Lead's detail page, domain-rewritten as above.
     */
    protected function buildLeadUrl(Lead $lead): string
    {
        return getDomainSpecificUrl(route('lead-contact.show', $lead->id), $lead->company);
    }

    /**
     * Log an automation action execution.
     */
    protected function logAction(
        Deal|Lead $subject,
        ?DealAutomation $automation,
        string $description,
        string $status = DealAutomationLog::STATUS_SUCCESS,
        ?string $channel = null,
        ?array $details = null,
    ): void {
        if (! $automation) {
            return;
        }

        try {
            DealAutomationLog::create([
                'company_id' => $subject->company_id,
                'deal_id' => $subject instanceof Deal ? $subject->id : null,
                'lead_id' => $subject instanceof Lead ? $subject->id : null,
                'automation_id' => $automation->id,
                'run_id' => $this->currentRunId,
                'action' => $description,
                'status' => $status,
                'channel' => $channel,
                'details' => $details,
                'executed_at' => now(),
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to log automation action', [
                'subject_type' => $subject instanceof Lead ? 'lead' : 'deal',
                'subject_id' => $subject->id,
                'exception' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Fetch a pipeline stage by ID.
     *
     * @param  int  $id
     * @return PipelineStage|null
     */
    protected function getStage($id)
    {
        return PipelineStage::find($id);
    }
}
