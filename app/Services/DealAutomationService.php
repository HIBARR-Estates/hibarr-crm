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
use App\Models\Lead;
use App\Models\LeadNote;
use App\Models\PipelineStage;
use App\Models\User;
use App\Traits\RecordsCrmEvents;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class DealAutomationService
{
    use RecordsCrmEvents;

    protected FieldResolverService $fieldResolver;

    protected ConditionEvaluatorService $conditionEvaluator;

    public function __construct(
        FieldResolverService $fieldResolver,
        ConditionEvaluatorService $conditionEvaluator
    ) {
        $this->fieldResolver = $fieldResolver;
        $this->conditionEvaluator = $conditionEvaluator;
    }

    /**
     * Process deal-subject automations for a deal based on its current state
     * and an optional trigger. Matches automations scoped to the deal's own
     * pipeline as well as ones with no pipeline scope (run for any pipeline).
     */
    public function process(Deal $deal, ?string $trigger = null): void
    {
        // Skip automation for locked deals
        if ($deal->is_locked) {
            Log::info("Skipping automations for locked Deal ID: {$deal->id}");

            return;
        }

        Log::info("Processing automations for Deal ID: {$deal->id}, Trigger: ".($trigger ?? 'None'));

        $automations = $this->getAutomations($deal->lead_pipeline_id, $trigger, DealAutomation::SUBJECT_DEAL);

        foreach ($automations as $automation) {
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
        Log::info("Processing automations for Lead ID: {$lead->id}, Trigger: ".($trigger ?? 'None'));

        $automations = $this->getAutomations(null, $trigger, DealAutomation::SUBJECT_LEAD);

        foreach ($automations as $automation) {
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
        $waitSeconds = $this->automationWaitSeconds($automation);

        if ($waitSeconds <= 0) {
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
     * Execute one pending run: called from the scheduler once run_at is due.
     * Everything is re-validated here because state may have moved on since
     * the trigger fired — the automation may have been deactivated or its
     * conditions may no longer hold; locked deals are skipped like in
     * process(); deleted subjects simply have their row dropped.
     */
    public function runPending(DealAutomationPendingRun $pendingRun): void
    {
        $subject = $pendingRun->subject_type === DealAutomation::SUBJECT_LEAD
            ? Lead::find($pendingRun->subject_id)
            : Deal::find($pendingRun->subject_id);

        if (! $subject) {
            Log::info("Dropping pending automation run #{$pendingRun->id}: subject no longer exists");

            return;
        }

        $automation = $pendingRun->automation;

        if (! $automation || ! $automation->active) {
            Log::info("Skipping pending automation run #{$pendingRun->id}: automation inactive or missing");

            return;
        }

        if ($subject instanceof Deal && $subject->is_locked) {
            Log::info("Skipping pending automation run #{$pendingRun->id}: Deal {$subject->id} is locked");

            return;
        }

        if (! $this->evaluateConditions($subject, $automation)) {
            Log::info("Conditions no longer met after wait for '{$automation->name}' (ID: {$automation->id}) on {$pendingRun->subject_type} {$pendingRun->subject_id}");

            return;
        }

        Log::info("Waited automation executing: {$automation->name} (ID: {$automation->id})");
        $this->executeActions($subject, $automation);
    }

    /**
     * The configured wait in seconds — 0 means "no wait, run immediately".
     */
    public function automationWaitSeconds(DealAutomation $automation): int
    {
        $value = $automation->wait_duration_value;

        if (! $value || (int) $value < 1) {
            return 0;
        }

        $value = (int) $value;

        return match ($automation->wait_duration_unit) {
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
        return DealAutomation::where('active', true)
            ->where('subject_type', $subjectType)
            ->when($subjectType === DealAutomation::SUBJECT_DEAL, function ($query) use ($pipelineId) {
                $query->where(function ($q) use ($pipelineId) {
                    $q->whereNull('pipeline_id')->orWhere('pipeline_id', $pipelineId);
                });
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
     * Execute actions defined in the automation.
     */
    protected function executeActions(Deal|Lead $subject, DealAutomation $automation): void
    {
        // NOTE: A general rule of thumb should be that actions should save quietly, so that there is no recursive loop
        foreach ($automation->actions as $action) {
            $this->performAction($subject, $action, $automation);
        }

        if (! ($subject instanceof Deal)) {
            return;
        }

        // After the actions we then emit the necessary events, such as mlm engine DealWonEvent. This is because we save the dealModel quietly to avoid cascades because we do support an array of actions that will cannot afford to trigger the deal observer as this will lead to recursive updates ...
        // MLM: Fire DealWonEvent when outcome_status changes to 'won'
        if ($subject->wasChanged('outcome_status') && $subject->outcome_status === \App\Enums\OutcomeStatus::Won && ! $subject->is_locked) {
            $this->fireDealWonEvent($subject);
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
                $this->logAction($deal, $automation, $description);

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
        $this->logAction($subject, $automation, $description);

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
        $this->logAction($deal, $automation, $description);

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
            $this->logAction($subject, $automation, 'Email skipped: template not found');

            return;
        }

        $recipients = $this->resolveEmailRecipients($subject, $action);

        if (empty($recipients)) {
            Log::warning("SendEmail action skipped for {$label}. No recipients resolved.");
            $this->logAction($subject, $automation, 'Email skipped: no recipients resolved');
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

        foreach ($recipients as $recipient) {
            try {
                Mail::to($recipient)->send(new DealAutomationTemplateEmail($subjectLine, $body, $preheaderText, $plunkTemplateId, $plunkVariables));
                $sent[] = $recipient;
            } catch (\Exception $e) {
                $failed[$recipient] = $e->getMessage();
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
        $this->logAction($subject, $automation, $description);

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
            $this->logAction($subject, $automation, $description2);

            $this->recordAutomationOutcomeEvent($subject, $automation, true, [
                'action' => 'automation_task_created',
                'comment' => "Task created by automation: {$title}",
                'task_id' => $task->id,
                'task_heading' => $title,
            ]);
        } catch (\Exception $e) {
            Log::error("Failed to create automation task for {$label}", [
                'exception' => $e->getMessage(),
            ]);
            $this->logAction($subject, $automation, "Task creation failed: {$e->getMessage()}");

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

        return $due->format(company()->date_format.' '.company()->time_format);
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
            $this->logAction($subject, $automation, 'Note skipped: no content');

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
            $this->logAction($subject, $automation, $description);

            $this->recordAutomationOutcomeEvent($subject, $automation, true, [
                'action' => 'automation_note_created',
                'comment' => 'Note added by automation: '.($title !== '' ? $title : 'Untitled'),
                'note_id' => $note->id,
                'note_title' => $note->title,
            ], $subject instanceof Lead ? 'lead_note_added' : 'deal_note_added');
        } catch (\Exception $e) {
            Log::error("Failed to create automation note for {$label}", [
                'exception' => $e->getMessage(),
            ]);
            $this->logAction($subject, $automation, "Note creation failed: {$e->getMessage()}");

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
            $this->logAction($subject, $automation, 'Meta Conversion skipped: no event name');

            return;
        }

        $value = (float) ($action->meta_event_value ?? 0);

        \App\Jobs\SendMetaConversionEventJob::dispatch($subject, $eventName, $value);

        $description = "Meta Conversion event queued: \"{$eventName}\"".($value > 0 ? " (value: {$value})" : '');
        Log::info("Action executed for {$label}. {$description}");
        $this->logAction($subject, $automation, $description);

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
    protected function logAction(Deal|Lead $subject, ?DealAutomation $automation, string $description): void
    {
        if (! $automation) {
            return;
        }

        try {
            DealAutomationLog::create([
                'company_id' => $subject->company_id,
                'deal_id' => $subject instanceof Deal ? $subject->id : null,
                'lead_id' => $subject instanceof Lead ? $subject->id : null,
                'automation_id' => $automation->id,
                'action' => $description,
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
