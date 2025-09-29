<?php

namespace App\Http\Controllers;

use App\Models\DealFollowUp;
use App\Models\MeetingSummary;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class MeetingSummaryApiController extends Controller
{
    public function getMeetingSummary(Request $request): JsonResponse
    {
        $request->validate([
            'meeting_summary' => 'required|array',
            'meeting_id' => 'required|string',
            'meeting_platform' => 'required|string'
        ]);

        $meetingSummary = $request->input('meeting_summary');
        $meetingId = $request->input('meeting_id');
        $meetingPlatform = $request->input('meeting_platform');

        $meetingInfo = $this->findOrFailMeetingId($meetingId, $meetingPlatform);
        
        if ($meetingInfo instanceof JsonResponse) {
            return $meetingInfo;
        }

        // Check if a summary already exists for this meeting
        $leadFollowUp = DealFollowUp::where('meeting_id', $meetingId)->first();
        
        if ($leadFollowUp && $leadFollowUp->summary_id) {
            // Update existing summary
            $summary = MeetingSummary::find($leadFollowUp->summary_id);
            if ($summary) {
                $summary->update([
                    'summary_object' => $meetingSummary,
                    'meeting_type_id' => $meetingInfo['meeting_type_id'],
                    'deal_id' => $meetingInfo['deal_id'],
                ]);
                
                return response()->json([
                    'success' => true,
                    'message' => 'Meeting summary updated successfully',
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

        // Update the lead_follow_up record with the summary_id
        if ($leadFollowUp) {
            $leadFollowUp->update(['summary_id' => $summary->id]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Meeting summary created successfully',
            'data' => $summary,
            'action' => 'created'
        ], 201);
    }

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
        
        // Get all meetings with the same meeting_id
        $meetings = DealFollowUp::where('meeting_id', $meetingId)->get();
        
        if($meetings->isEmpty()){
            return response()->json(['error' => 'Meeting not found'], 404);
        }
        
        // Find the meeting that matches the platform/location
        $meetingInfo = $meetings->firstWhere('location', $meetingPlatform);
        
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
}