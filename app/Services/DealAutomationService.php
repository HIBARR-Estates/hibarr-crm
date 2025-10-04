<?php

namespace App\Services;

use App\Models\Deal;
use App\Models\LeadPipeline;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use App\Enums\MeetingType; 

/**
 * Service to automate the progression of deals through pipeline stages
 * based on predefined business rules.
 */
class DealAutomationService
{
    private array $stages = [];

    public function __construct()
    {
        // Stages will be initialized dynamically from pipeline, as opposed to defaulting to first pipeline stage or pipeline with id of 1.
    }

    /**
     * Automate deal progression through stages.
     */
    public function automate(Deal $deal): void
    {
        $this->initializeStages($deal);

        $currentStage = $this->defineStage($deal);
        $currentStageId = $currentStage['id'] ?? null;

        DB::transaction(function () use ($deal, $currentStageId) {
            switch ($currentStageId) {
                case $this->stages['stage_1']['id']:
                    $this->moveTo('stage_2', $deal);
                    break;
                case $this->stages['stage_2']['id']:
                    $this->moveTo('stage_3', $deal);
                    break;
                case $this->stages['stage_3']['id']:
                    $this->moveTo('stage_4', $deal);
                    break;
                case $this->stages['stage_4']['id']:
                    $this->moveTo('stage_5', $deal);
                    break;
                default:
                    Log::warning("Deal ID {$deal->id}: stage could not be determined or already final.");
            }
        });
    }

    /**
     * Initialize stages from pipeline (must have at least 5).
     */
    private function initializeStages(Deal $deal): void
    {
        $pipeline = $deal->lead_pipeline_id
            ? LeadPipeline::find($deal->lead_pipeline_id)
            : LeadPipeline::first();

        if (!$pipeline) {
            Log::warning("Deal ID {$deal->id}: no pipeline found; skipping automation");
            $this->stages = [];
            return;
        }

        $stages = $pipeline->stages()->orderBy('priority')->get();

        if ($stages->count() < 5) {
            Log::warning("Deal ID {$deal->id}: pipeline has insufficient stages ({$stages->count()}); skipping automation");
            $this->stages = [];
            return;
        }

        
        $this->stages = [
            'stage_1' => ['id' => $stages[0]->id, 'name' => $stages[0]->name],
            'stage_2' => ['id' => $stages[1]->id, 'name' => $stages[1]->name],
            'stage_3' => ['id' => $stages[2]->id, 'name' => $stages[2]->name],
            'stage_4' => ['id' => $stages[3]->id, 'name' => $stages[3]->name],
            'stage_5' => ['id' => $stages[4]->id, 'name' => $stages[4]->name],
        ];
    }

    /**
     * Define current stage based on deal attributes & business rules.
     */
    private function defineStage(Deal $deal): array
    {
        if (!$deal->followup || $deal->followup?->meeting_type !== MeetingType::KickOff->value) {
            return $this->stages['stage_1'];
        }

        if ($deal->followup && $deal->pipeline_stage_id === $this->stages['stage_2']['id'] && !$deal->strategy_accepted) {
            return $this->stages['stage_2'];
        }

        if ($deal->strategy_accepted && $deal->pipeline_stage_id === $this->stages['stage_3']['id'] && !$deal->downpayment_confirmed) {
            return $this->stages['stage_3'];
        }

        if ($deal->pipeline_stage_id === $this->stages['stage_4']['id'] && $deal->downpayment_confirmed) {
            return $this->stages['stage_4'];
        }

        // Stage 5 is considered final — no automation beyond this
        if ($deal->pipeline_stage_id === $this->stages['stage_5']['id']) {
            return $this->stages['stage_5'];
        }

        return []; // Undefined state
    }

    /**
     * Move deal to a new stage and log it.
     */
    private function moveTo(string $targetStage, Deal $deal): void
    {
        if (!isset($this->stages[$targetStage])) {
            throw new \InvalidArgumentException("Target stage {$targetStage} not defined.");
        }

        $deal->pipeline_stage_id = $this->stages[$targetStage]['id'];
        $deal->saveQuietly();

        Log::info("Deal ID {$deal->id} moved to {$this->stages[$targetStage]['name']}");
    }
}
