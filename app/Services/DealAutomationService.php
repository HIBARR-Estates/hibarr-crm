<?php

namespace App\Services;

use App\Models\Deal;
use Illuminate\Support\Facades\Log;

/**
 * This service automates the progression of deals through various stages based on predefined business rules.
 * 
 */

class DealAutomationService
{
    protected $stage_1 = "Stage 1: Lead Stage"; // No follow-up exists
    protected $stage_2 = "Stage 2: Prospect Stage"; // Follow-up exists but no strategy meeting has been accepted
    protected $stage_3 = "Stage 3: Stage 3"; // Strategy meeting has been accepted but no down_payment made
    protected $stage_4 = "Stage 4: Stage 4"; // Strategy meeting accepted and down_payment made

    public function __construct()
    {
        // TODO: Add an n8n logger as per request of Developer(@gh:einstein-john)
        // TODO: Update moverMethods to have any side effects that are ought to be specified by business rules
        // Initialization code if needed
    }
    public function automate(Deal $deal)
    {
        // There are 4 stages, and you'll have to first define what stage the deal is in.
        // after which you define what actions/methods to take based on the stage.
        $currentStage = $this->defineStage($deal);
        switch ($currentStage) {
            case $this->stage_1:
                $this->moveToStage2($deal);
                Log::info("Deal ID {$deal->id} moved to Stage 2");
                break;
            case $this->stage_2:
                $this->moveToStage3($deal);
                Log::info("Deal ID {$deal->id} moved to Stage 3");
                break;
            case $this->stage_3:
                $this->moveToStage4($deal);
                Log::info("Deal ID {$deal->id} moved to Stage 4");
                break;
            case $this->stage_4:
                Log::info("Deal ID {$deal->id} is already in Stage 4. No further action taken.");
                // TODO: Confirm if there are any side effects or actions to be taken when a deal is in Stage 4
                break;

            default:
                throw new \Exception("Unknown stage: " . $currentStage);
        }
        
    }

    private function moveToStage2(Deal $deal)
    {
        // Logic to move deal to Stage 2
        $deal->pipeline_stage_id = 2; //TODO: Confirm this values and map to meaningful constants or enums, as this was just communicated by Developer(@gh:einstein-john) in requirement gathering
        $deal->save();
    }

    private function moveToStage3(Deal $deal)
    {
        // Logic to move deal to Stage 3
        $deal->pipeline_stage_id = 3; //TODO: Confirm this values and map to meaningful constants or enums, as this was just communicated by Developer(@gh:einstein-john) in requirement gathering
        $deal->save();
    }
    private function moveToStage4(Deal $deal)
    {
        // Logic to move deal to Stage 4
        $deal->pipeline_stage_id = 4; //TODO: Confirm this values and map to meaningful constants or enums, as this was just communicated by Developer(@gh:einstein-john) in requirement gathering
        $deal->save();
    }

    private function defineStage(Deal $deal): string
    {
        if (!($deal->followup && $deal->followup?->meeting_type == 'kick_off')) { //TODO: Confirm the meeting_type value with meaningful constant or enum, as this was just communicated by Developer(@gh:einstein-john) in requirement gathering
            return $this->stage_1; // No follow-up exists
        }
        if ($deal->followup && $deal->pipeline_stage_id == 2 && !$deal->strategy_accepted) {
            return $this->stage_2; // Follow-up exists but no strategy meeting has been accepted
        }
        if ($deal->strategy_accepted && $deal->pipeline_stage_id == 3 && !$deal->downpayment_confirmed) {
            return $this->stage_3; // Strategy meeting has been accepted but no down_payment made
        }
        if ($deal->pipeline_stage_id == 4 && $deal->downpayment_confirmed) {
            return $this->stage_4; // Strategy meeting accepted and down_payment made
        }
        throw new \Exception("Unable to determine the stage for the deal.");
    }

}