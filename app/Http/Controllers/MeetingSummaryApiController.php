<?php

namespace App\Http\Controllers;

use App\Models\MeetingSummary;
use App\Models\DealFollowUp;
use App\Models\Deal;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Log;

class MeetingSummaryApiController extends Controller
{
    /**
     * Get or create meeting summary
     */
    public function getMeetingSummary(Request $request): JsonResponse
    {
        $request->validate([
            'meeting_id' => 'required|string',
            'meeting_platform' => 'required|string',
            'meeting_summary' => 'required|array'
        ]);

        $meetingId = $request->meeting_id;
        $meetingPlatform = $request->meeting_platform;
        $meetingSummary = $request->meeting_summary;

        // Find meeting info
        $meetingInfo = $this->findOrFailMeetingId($meetingId, $meetingPlatform);
        
        if (is_array($meetingInfo) && isset($meetingInfo['deal_id'])) {
            // Meeting found, proceed with create/update
            return $this->createOrUpdateSummary($meetingSummary, $meetingId, $meetingPlatform, $meetingInfo);
        } else {
            // Return error response
            return $meetingInfo;
        }
    }

    /**
     * Create or update meeting summary
     */
    private function createOrUpdateSummary($meetingSummary, $meetingId, $meetingPlatform, $meetingInfo)
    {
        return DB::transaction(function () use ($meetingSummary, $meetingId, $meetingPlatform, $meetingInfo) {
            // Lock the follow-up row to prevent concurrent modifications
            // Use case-insensitive comparison for platform/location
            $leadFollowUp = DealFollowUp::where('meeting_id', $meetingId)
                                       ->whereRaw('LOWER(location) = LOWER(?)', [$meetingPlatform])
                                       ->lockForUpdate()
                                       ->first();
            
            if ($leadFollowUp && $leadFollowUp->summary_id) {
                // Update existing summary
                $summary = MeetingSummary::find($leadFollowUp->summary_id);
                if ($summary) {
                    $summary->update([
                        'summary_object' => $meetingSummary,
                        'meeting_type_id' => $meetingInfo['meeting_type_id'],
                        'deal_id' => $meetingInfo['deal_id'],
                    ]);
                    
                    // Send email notification for updated summary
                    $this->sendSummaryNotification($summary, $leadFollowUp, 'updated');
                    
                    return response()->json([
                        'success' => true,
                        'message' => 'Meeting summary updated successfully',
                        'data' => $summary,
                        'action' => 'updated'
                    ], 200);
                }
            }
            
            // Create new summary
            $summary = MeetingSummary::create([
                'summary_object' => $meetingSummary,
                'meeting_type_id' => $meetingInfo['meeting_type_id'],
                'deal_id' => $meetingInfo['deal_id'],
            ]);

            // Update the DealFollowUp record with the summary_id
            if ($leadFollowUp) {
                $leadFollowUp->update(['summary_id' => $summary->id]);
            }

            // Send email notification for new summary
            $this->sendSummaryNotification($summary, $leadFollowUp, 'created');

            return response()->json([
                'success' => true,
                'message' => 'Meeting summary created successfully',
                'data' => $summary,
                'action' => 'created'
            ], 201);
        });
    }

    /**
     * Find meeting by ID and platform
     */
    private function findOrFailMeetingId(string $meetingId, string $meetingPlatform)
    {
        $meeting = [];
        $meeting['deal_id'] = null;
        $meeting['meeting_type_id'] = null;
        
        if(!$meetingId){
            return response()->json(['error' => 'Meeting ID is required'], 400);
        }
        
        if(!$meetingPlatform){
            return response()->json(['error' => 'Meeting platform is required'], 400);
        }
        
        // Get all DealFollowUp records with the same meeting_id
        $meetings = DealFollowUp::where('meeting_id', $meetingId)->get();
        
        if($meetings->isEmpty()){
            return response()->json(['error' => 'Meeting not found'], 404);
        }
        
        // Find the DealFollowUp record that matches the platform/location (case-insensitive)
        $meetingInfo = $meetings->first(function ($meeting) use ($meetingPlatform) {
            return strtolower($meeting->location) === strtolower($meetingPlatform);
        });
        
        if(!$meetingInfo){
            // If no exact match, return all available platforms for this meeting_id
            $availablePlatforms = $meetings->pluck('location')->unique()->values()->toArray();
            return response()->json([
                'error' => 'Meeting platform mismatch',
                'message' => "Meeting found but platform '{$meetingPlatform}' does not match",
                'available_platforms' => $availablePlatforms,
                'meeting_id' => $meetingId
            ], 400);
        }
        
        $meeting['deal_id'] = $meetingInfo->deal_id;
        $meeting['meeting_type_id'] = $meetingInfo->meeting_type_id;
        $meeting['location'] = $meetingInfo->location;
        return $meeting;
    }

    /**
     * Send email notification for meeting summary
     */
    private function sendSummaryNotification($summary, $leadFollowUp, $action)
    {
        try {
            // Get the deal information
            $deal = Deal::find($summary->deal_id);
            if (!$deal) {
                return;
            }

            // Get the responsible person (deal agent)
            $responsiblePerson = null;
            if ($deal->agent_id) {
                $responsiblePerson = User::find($deal->agent_id);
            }

            // If no agent, try to get the deal creator
            if (!$responsiblePerson && $deal->added_by) {
                $responsiblePerson = User::find($deal->added_by);
            }

            // If still no responsible person, get the follow-up creator
            if (!$responsiblePerson && $leadFollowUp->added_by) {
                $responsiblePerson = User::find($leadFollowUp->added_by);
            }

            if (!$responsiblePerson) {
                return;
            }

            // Send the notification
            $responsiblePerson->notify(new \App\Notifications\MeetingSummaryNotification(
                $summary, 
                $leadFollowUp, 
                $deal, 
                $action
            ));

        } catch (\Exception $e) {
            // Don't throw the exception to avoid breaking the main flow
        }
    }
}
