<?php

namespace App\Http\Controllers;

use App\Models\MeetingSummary;
use App\Models\LeadFollowUp;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class MeetingSummaryController extends Controller
{
    /**
     * Store a new meeting summary
     */
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'summary_object' => 'required|array',
            'meeting_type_id' => 'nullable|integer|exists:meeting_types,id',
            'deal_id' => 'nullable|integer|exists:deals,id',
            'meeting_id' => 'nullable|string'
        ]);

        $meetingSummary = MeetingSummary::create([
            'summary_object' => $request->summary_object,
            'meeting_type_id' => $request->meeting_type_id,
            'deal_id' => $request->deal_id,
        ]);

        // If meeting_id is provided, update the lead_follow_up record
        if ($request->meeting_id) {
            $leadFollowUp = LeadFollowUp::where('meeting_id', $request->meeting_id)->first();
            if ($leadFollowUp) {
                $leadFollowUp->update(['summary_id' => $meetingSummary->id]);
            }
        }

        return response()->json([
            'success' => true,
            'message' => 'Meeting summary saved successfully',
            'data' => $meetingSummary
        ], 201);
    }

    /**
     * Get meeting summary by ID
     */
    public function show($id): JsonResponse
    {
        $meetingSummary = MeetingSummary::with(['meetingType', 'deal'])->findOrFail($id);

        return response()->json([
            'success' => true,
            'data' => $meetingSummary
        ]);
    }

    /**
     * Update meeting summary
     */
    public function update(Request $request, $id): JsonResponse
    {
        $request->validate([
            'summary_object' => 'sometimes|array',
            'meeting_type_id' => 'sometimes|integer|exists:meeting_types,id',
            'deal_id' => 'sometimes|integer|exists:deals,id',
        ]);

        $meetingSummary = MeetingSummary::findOrFail($id);
        $meetingSummary->update($request->only(['summary_object', 'meeting_type_id', 'deal_id']));

        return response()->json([
            'success' => true,
            'message' => 'Meeting summary updated successfully',
            'data' => $meetingSummary
        ]);
    }

    /**
     * Delete meeting summary
     */
    public function destroy($id): JsonResponse
    {
        $meetingSummary = MeetingSummary::findOrFail($id);
        $meetingSummary->delete();

        return response()->json([
            'success' => true,
            'message' => 'Meeting summary deleted successfully'
        ]);
    }

    /**
     * Get meeting summary by meeting ID
     */
    public function getByMeetingId($meetingId): JsonResponse
    {
        $leadFollowUp = LeadFollowUp::where('meeting_id', $meetingId)->first();
        
        if (!$leadFollowUp || !$leadFollowUp->summary_id) {
            return response()->json([
                'success' => false,
                'message' => 'Meeting summary not found'
            ], 404);
        }

        $meetingSummary = MeetingSummary::with(['meetingType', 'deal'])->find($leadFollowUp->summary_id);

        return response()->json([
            'success' => true,
            'data' => $meetingSummary
        ]);
    }
}
