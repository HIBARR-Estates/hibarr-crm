<?php

namespace App\Http\Controllers;

use App\Enums\MeetingAttendanceOutcome;
use App\Models\DealFollowUp;
use App\Services\MeetingAttendanceConfirmationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MeetingAttendanceConfirmationController extends Controller
{
    public function __construct(
        private readonly MeetingAttendanceConfirmationService $service,
    ) {
    }

    /**
     * The single oldest meeting awaiting an attendance-outcome confirmation
     * from the current user, or null when nothing is due.
     */
    public function pending(): JsonResponse
    {
        $followUp = $this->service->pendingForUser(user());

        if (!$followUp) {
            return response()->json([
                'status' => 'success',
                'message' => '',
                'data' => null,
            ]);
        }

        return response()->json([
            'status' => 'success',
            'message' => '',
            'data' => $this->present($followUp),
        ]);
    }

    public function confirm(Request $request, DealFollowUp $followUp): JsonResponse
    {
        if ($followUp->assignedAgentUserId() !== (int) user()->id) {
            return response()->json([
                'status' => 'fail',
                'message' => 'You do not have permission to confirm this meeting.',
            ], 403);
        }

        $validated = $request->validate([
            'outcome' => ['required', 'string', 'in:' . implode(',', array_column(MeetingAttendanceOutcome::cases(), 'value'))],
            'note' => ['nullable', 'string', 'max:2000'],
        ]);

        $outcome = MeetingAttendanceOutcome::from($validated['outcome']);

        $followUp = $this->service->confirm($followUp, user(), $outcome, $validated['note'] ?? null);

        return response()->json([
            'status' => 'success',
            'message' => 'Meeting outcome saved.',
            'data' => [
                'id' => $followUp->id,
                'attendance_outcome' => $followUp->attendance_outcome,
            ],
        ]);
    }

    private function present(DealFollowUp $followUp): array
    {
        $followUp->loadMissing(['deal.contact', 'lead', 'meetingType']);

        DealFollowUp::attachParticipantUsers(collect([$followUp]));

        $contactName = $followUp->deal?->contact?->client_name
            ?? $followUp->lead?->client_name
            ?? null;

        return [
            'id' => $followUp->id,
            'deal_id' => $followUp->deal_id,
            'lead_id' => $followUp->lead_id,
            'contact_name' => $contactName,
            'meeting_type_label' => $followUp->meetingType?->type,
            'scheduled_at' => $followUp->next_follow_up_date?->toIso8601String(),
            'duration' => $followUp->effective_duration,
            'location' => $followUp->location,
            'meeting_link' => $followUp->meeting_link,
            'remark' => $followUp->remark,
            'participants' => $followUp->participant_users,
        ];
    }
}
