<?php

namespace App\Services;

use App\Models\Deal;
use App\Models\DealAutomation;
use App\Models\PipelineStage;
use Illuminate\Support\Facades\Log;

class DealAutomationService
{
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
                $condition->operator,
                $condition->value
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
        foreach ($automation->actions as $action) {
            $this->performAction($deal, $action);
        }
    }

    /**
     * Perform a single action on the deal.
     *
     * @param Deal $deal
     * @param \App\Models\DealAutomationAction $action
     * @return void
     */
    protected function performAction(Deal $deal, $action): void
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
                $deal->save();
                Log::info("Action executed for Deal ID: {$deal->id}. " . implode(', ', $changes));
            }
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
