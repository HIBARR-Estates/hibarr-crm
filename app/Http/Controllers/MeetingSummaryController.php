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
            'meeting_type_id' => 'nullable|integer|exists:meeting_types,id',
            'deal_id' => 'nullable|integer|exists:deals,id',
            'meeting_id' => 'nullable|string',
            'meeting_platform' => 'nullable|string'
        ]);

        return DB::transaction(function () use ($request) {
            $meetingSummary = MeetingSummary::create([
                'summary_object' => $request->summary_object,
                'meeting_type_id' => $request->meeting_type_id,
                'deal_id' => $request->deal_id,
            ]);

            if ($request->filled('meeting_id')) {
                $leadFollowUp = DealFollowUp::where('meeting_id', $request->meeting_id)
                    ->when($request->filled('meeting_platform'), function ($q) use ($request) {
                        $q->whereRaw('LOWER(location) = LOWER(?)', [$request->meeting_platform]);
                    })
                    ->lockForUpdate()
                    ->first();

                if ($leadFollowUp) {
                    $leadFollowUp->summary_id = $meetingSummary->id;
                    $leadFollowUp->save();
                }
            }

            return response()->json([
                'success' => true,
                'message' => 'Meeting summary saved successfully',
                'data' => $meetingSummary
            ], 201);
        });
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
        
        // Nullify orphaned references
        DealFollowUp::where('summary_id', $id)->update(['summary_id' => null]);
        
        $meetingSummary->delete();

        return response()->json([
            'success' => true,
            'message' => 'Meeting summary deleted successfully'
        ]);
    }

    /**
     * Get meeting summary by meeting ID
     */
    public function getByMeetingId($meetingId, Request $request): JsonResponse
    {
        $query = DealFollowUp::where('meeting_id', $meetingId);
        
        if ($request->filled('meeting_platform')) {
            $query->whereRaw('LOWER(location) = LOWER(?)', [$request->meeting_platform]);
        }
        
        $leadFollowUp = $query->first();
        
        if (!$leadFollowUp || !$leadFollowUp->summary_id) {
            return response()->json([
                'success' => false,
                'message' => 'Meeting summary not found'
            ], 404);
        }

        $meetingSummary = MeetingSummary::with(['meetingType', 'deal'])->find($leadFollowUp->summary_id);
        if (!$meetingSummary) {
            return response()->json([
                'success' => false,
                'message' => 'Meeting summary not found'
            ], 404);
        }
        return response()->json([
            'success' => true,
            'data' => $meetingSummary
        ]);
    }
}
