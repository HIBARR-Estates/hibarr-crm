<?php

namespace App\Http\Controllers;

use App\Models\MeetingSummary;
use App\Models\DealFollowUp;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class MeetingSummaryController extends Controller
{
    /**
     * Store a new meeting summary
     */
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'summary_object' => 'required|array',
            'deal_id' => 'required|exists:deals,id',
            'meeting_id' => 'nullable|string',
        ]);

        return DB::transaction(function () use ($request) {
            $meetingSummary = MeetingSummary::create([
                'summary_object' => $request->summary_object,
                'deal_id' => $request->deal_id,
            ]);

            // If meeting_id is provided, update the lead_follow_up record
            if ($request->meeting_id) {
                $leadFollowUp = DealFollowUp::where('meeting_id', $request->meeting_id)
                    ->lockForUpdate()
                    ->first();
                if ($leadFollowUp) {
                    $leadFollowUp->update(['summary_id' => $meetingSummary->id]);
                }
            }

            return response()->json([
                'success' => true,
                'message' => 'Meeting summary created successfully',
                'data' => $meetingSummary
            ], 201);
        });
    }

    /**
     * Display the specified meeting summary
     */
    public function show($summaryId)
    {
        try {
            // Find the meeting summary by ID
            $meetingSummary = MeetingSummary::find($summaryId);
            
            if (!$meetingSummary) {
                if (request()->ajax()) {
                    return view('leads.ajax.meeting-summary-modal', ['summary' => []])->withErrors(['error' => 'Meeting summary not found']);
                }
                return response()->json([
                    'success' => false,
                    'message' => 'Meeting summary not found'
                ], 404);
            }
            
            // Load relationships
            $meetingSummary->load(['deal']);
            
            // Load meetingType only if it exists
            if ($meetingSummary->meeting_type_id) {
                $meetingSummary->load(['meetingType']);
            }
            
            
            // Return view for web requests (ajaxModal)
            if (request()->ajax()) {
                return view('leads.ajax.meeting-summary-modal', ['summary' => $meetingSummary->toArray()]);
            }
            
            // Return JSON for API requests
            return response()->json([
                'success' => true,
                'data' => $meetingSummary
            ]);
        } catch (\Exception $e) {
            \Log::error('MeetingSummary show error: ' . $e->getMessage());
            
            if (request()->ajax()) {
                return view('leads.ajax.meeting-summary-modal', ['summary' => []])->withErrors(['error' => $e->getMessage()]);
            }
            
            return response()->json([
                'success' => false,
                'message' => 'Error loading meeting summary'
            ], 500);
        }
    }

    /**
     * Update the specified meeting summary
     */
    public function update(Request $request, MeetingSummary $meetingSummary): JsonResponse
    {
        $request->validate([
            'summary_object' => 'required|array',
        ]);

        $meetingSummary->update([
            'summary_object' => $request->summary_object,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Meeting summary updated successfully',
            'data' => $meetingSummary
        ]);
    }

    /**
     * Remove the specified meeting summary
     */
    public function destroy(MeetingSummary $meetingSummary): JsonResponse
    {
        DealFollowUp::where('summary_id', $meetingSummary->id)->update(['summary_id' => null]);
        
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
        $leadFollowUp = DealFollowUp::where('meeting_id', $meetingId)->first();
        
        if (!$leadFollowUp || !$leadFollowUp->summary_id) {
            return response()->json([
                'success' => false,
                'message' => 'Meeting summary not found'
            ], 404);
        }

        $summary = MeetingSummary::with(['deal', 'meetingType'])->find($leadFollowUp->summary_id);

        return response()->json([
            'success' => true,
            'data' => $summary
        ]);
    }

}
