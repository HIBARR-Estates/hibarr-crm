<?php

namespace App\Http\Controllers\Api;

use App\Helper\Reply;
use App\Models\Deal;
use App\Models\DealHistory;
use App\Models\PipelineStage;
use Illuminate\Http\Request;
use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\DB;

class DealApiController extends Controller
{
    /**
     * Create a new controller instance.
     */
    public function __construct()
    {
        // $this->middleware('api.token.auth');
    }

 
    /**
     * Change the stage of a deal.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function changeStage(Request $request)
    {
        try {
            $dealId = $request->input('deal_id');
            $newStageId = $request->input('new_stage_id');

            // Debug logging
            \Log::info('API Request Data:', [
                'deal_id' => $dealId,
                'new_stage_id' => $newStageId,
                'request_data' => $request->all()
            ]);

            // Check if deal exists
            $deal = Deal::find($dealId);
            if (!$deal) {
                return Reply::error("Deal with ID {$dealId} not found.");
            }

            // Check if stage exists
            $newStage = PipelineStage::find($newStageId);
            if (!$newStage) {
                return Reply::error("Pipeline stage with ID {$newStageId} not found.");
            }

            // Check if the stage is 'win' or 'lost' - don't allow changes
            if (in_array($newStage->slug, ['win', 'lost'])) {
                return Reply::error('Cannot change to win or lost stage directly. Use the proper win/lost process.');
            }

            // Store the old stage for comparison
            $oldStageId = $deal->pipeline_stage_id;

            // Get the responsible agent's user ID for proper tracking
            $responsibleUserId = null;
            if ($deal->agent_id) {
                $leadAgent = \App\Models\LeadAgent::find($deal->agent_id);
                if ($leadAgent && $leadAgent->user) {
                    $responsibleUserId = $leadAgent->user->id;
                }
            }

            // Use the same approach as the existing changeStage method
            // Update the deal stage directly without triggering observers
            \DB::table('deals')
                ->where('id', $dealId)
                ->update(['pipeline_stage_id' => $newStageId]);

            // Create deal history manually with the responsible agent's user ID
            if ($responsibleUserId) {
                \App\Models\DealHistory::create([
                    'deal_id' => $dealId,
                    'event_type' => 'stage-updated',
                    'created_by' => $responsibleUserId,
                    'deal_stage_from_id' => $oldStageId,
                    'deal_stage_to_id' => $newStageId,
                ]);
            }

            // Reload the deal
            $deal = Deal::find($dealId);
            $deal->load(['leadStage', 'pipeline', 'contact', 'leadAgent.user']);

            // Get stage and pipeline names safely
            $stageName = 'Unknown';
            $pipelineName = 'Unknown';
            
            if ($deal->leadStage) {
                $stageName = $deal->leadStage->name;
            }
            
            if ($deal->pipeline) {
                $pipelineName = $deal->pipeline->name;
            }

            return Reply::successWithData('Deal stage changed successfully', [
                'deal' => $deal,
                'old_stage_id' => $oldStageId,
                'new_stage_id' => $newStageId,
                'stage_name' => $stageName,
                'pipeline_name' => $pipelineName,
                'responsible_user_id' => $responsibleUserId,
                'responsible_user_name' => $deal->leadAgent && $deal->leadAgent->user ? $deal->leadAgent->user->name : 'Unknown'
            ]);

        } catch (\Exception $e) {
            \Log::error('Deal Stage Change Error:', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'request_data' => $request->all()
            ]);
            return Reply::error('An error occurred while changing deal stage: ' . $e->getMessage());
        }
    }

}
