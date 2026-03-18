<?php

namespace App\Services;

use App\Models\Deal;
use App\Models\DealAutomation;
use App\Models\DealAutomationLog;
use App\Models\PipelineStage;
use App\Events\DealWonEvent;
use App\Traits\RecordsCrmEvents;
use Illuminate\Support\Facades\Log;

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
     * Process automations for a deal based on its current state and an optional trigger.
     *
     * @param Deal $deal
     * @param string|null $trigger
     * @return void
     */
    public function process(Deal $deal, ?string $trigger = null): void
    {
        // Skip automation for locked deals
        if ($deal->is_locked) {
            Log::info("Skipping automations for locked Deal ID: {$deal->id}");
            return;
        }

        Log::info("Processing automations for Deal ID: {$deal->id}, Trigger: " . ($trigger ?? 'None'));

        // Fetch active automations for the deal's pipeline and trigger
        $automations = $this->getAutomations($deal->lead_pipeline_id, $trigger);

        foreach ($automations as $automation) {
            if ($this->evaluateConditions($deal, $automation)) {
                Log::info("Automation matched: {$automation->name} (ID: {$automation->id})");
                $this->executeActions($deal, $automation);
            }
        }
    }

    /**
     * Fetch automations from the database.
     *
     * @param int $pipelineId
     * @param string|null $trigger
     * @return \Illuminate\Database\Eloquent\Collection
     */
    protected function getAutomations(int $pipelineId, ?string $trigger)
    {
        return DealAutomation::where('active', true)
            ->where('pipeline_id', $pipelineId)
            ->where(function ($query) use ($trigger) {
                $query->where('trigger', $trigger)
                      ->orWhereNull('trigger');
            })
            ->orderBy('priority', 'desc') // Higher priority runs first
            ->with(['conditions', 'actions'])
            ->get();
    }

    /**
     * Evaluate all conditions for a given automation.
     *
     * @param Deal $deal
     * @param DealAutomation $automation
     * @return bool
     */
    protected function evaluateConditions(Deal $deal, DealAutomation $automation): bool
    {
        if ($automation->conditions->isEmpty()) {
            return true; // No conditions means it always runs if triggered
        }

        foreach ($automation->conditions as $condition) {
            $fieldValue = $this->fieldResolver->resolve($deal, $condition->field);
            
            $passed = $this->conditionEvaluator->evaluate(
                $fieldValue,
                $condition
            );

            if (!$passed) {
                return false; // All conditions must pass (AND logic)
            }
        }

        return true;
    }

    /**
     * Execute actions defined in the automation.
     *
     * @param Deal $deal
     * @param DealAutomation $automation
     * @return void
     */
    protected function executeActions(Deal $deal, DealAutomation $automation): void
    {
        // NOTE: A general rule of thumb should be that actions should save deals quietly, so that there is no recursive loop
        foreach ($automation->actions as $action) {
            $this->performAction($deal, $action, $automation);
        }
        // After the actions we then emit the necessary events, such as mlm engine DealWonEvent. This is because we save the dealModel quietly to avoid cascades because we do support an array of actions that will cannot afford to trigger the deal observer as this will lead to recursive updates ...
        // MLM: Fire DealWonEvent when outcome_status changes to 'won'
        if ($deal->wasChanged('outcome_status') && $deal->outcome_status === \App\Enums\OutcomeStatus::Won && !$deal->is_locked) {
            $this->fireDealWonEvent($deal);
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
     * Perform a single action on the deal.
     *
     * Supports action types:
     * - stage_transition (default/legacy): Move deal to target stage/pipeline
     * - set_field_value: Set a field on the deal to a specific value
     * - lock_deal: Lock the deal and set locked_at timestamp
     *
     * @param Deal $deal
     * @param \App\Models\DealAutomationAction $action
     * @param DealAutomation|null $automation
     * @return void
     */
    protected function performAction(Deal $deal, $action, ?DealAutomation $automation = null): void
    {
        $actionType = $action->action_type ?? 'stage_transition';

        match ($actionType) {
            'set_field_value' => $this->performSetFieldValue($deal, $action, $automation),
            'lock_deal' => $this->performLockDeal($deal, $action, $automation),
            default => $this->performStageTransition($deal, $action, $automation),
        };
    }

    /**
     * Perform a stage transition action (legacy behavior).
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

            if (!empty($changes)) {
                $deal->saveQuietly(); // Bypass observer to prevent cascading
                $description = "Stage transition: " . implode(', ', $changes);
                Log::info("Action executed for Deal ID: {$deal->id}. " . implode(', ', $changes));
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
     * Perform a set_field_value action.
     */
    protected function performSetFieldValue(Deal $deal, $action, ?DealAutomation $automation = null): void
    {
        $fieldName = $action->field_name;
        $fieldValue = $action->field_value;

        if (!$fieldName) {
            Log::warning("SetFieldValue action missing field_name for Deal ID: {$deal->id}");
            return;
        }

        $deal->{$fieldName} = $fieldValue;
        $deal->saveQuietly(); // Bypass observer to prevent cascading

        $description = "Set {$fieldName} = {$fieldValue}";
        Log::info("Action executed for Deal ID: {$deal->id}. {$description}");
        $this->logAction($deal, $automation, $description);

        // Record CRM event for automation-driven field change
        $this->recordCrmEvent('deal_updated', $deal, [
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
     * Perform a lock_deal action.
     */
    protected function performLockDeal(Deal $deal, $action, ?DealAutomation $automation = null): void
    {
        $deal->is_locked = true;
        $deal->locked_at = now();
        $deal->saveQuietly(); // Bypass observer to prevent cascading

        $description = "Deal locked";
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
     * Log an automation action execution.
     */
    protected function logAction(Deal $deal, ?DealAutomation $automation, string $description): void
    {
        if (!$automation) {
            return;
        }

        try {
            DealAutomationLog::create([
                'company_id' => $deal->company_id,
                'deal_id' => $deal->id,
                'automation_id' => $automation->id,
                'action' => $description,
                'executed_at' => now(),
            ]);
        } catch (\Exception $e) {
            Log::error("Failed to log automation action for Deal ID: {$deal->id}", [
                'exception' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Fetch a pipeline stage by ID.
     *
     * @param int $id
     * @return PipelineStage|null
     */
    protected function getStage($id)
    {
        return PipelineStage::find($id);
    }
}
