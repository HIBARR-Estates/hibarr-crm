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
     * Every meeting awaiting an attendance-outcome confirmation from the
     * current user, oldest first.
     */
    public function pending(): JsonResponse
    {
        $followUps = $this->service->pendingListForUser(user());

        return response()->json([
            'status' => 'success',
            'message' => '',
            'data' => $followUps->map(fn (DealFollowUp $followUp) => $this->present($followUp))->values(),
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

    public function snooze(Request $request, DealFollowUp $followUp): JsonResponse
    {
        if ($followUp->assignedAgentUserId() !== (int) user()->id) {
            return response()->json([
                'status' => 'fail',
                'message' => 'You do not have permission to snooze this meeting.',
            ], 403);
        }

        $validated = $request->validate([
            // 0 clears an existing snooze immediately — used by the frontend's "Undo".
            'minutes' => ['nullable', 'integer', 'min:0'],
        ]);

        $followUp = $this->service->snooze($followUp, $validated['minutes'] ?? null);

        return response()->json([
            'status' => 'success',
            'message' => '',
            'data' => [
                'id' => $followUp->id,
                'attendance_confirmation_snoozed_until' => $followUp->attendance_confirmation_snoozed_until?->toIso8601String(),
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
            'meeting_type_label' => $followUp->meetingType?->name,
            'scheduled_at' => $followUp->next_follow_up_date?->toIso8601String(),
            'duration' => $followUp->effective_duration,
            'location' => $followUp->location,
            'meeting_link' => $followUp->meeting_link,
            'remark' => $followUp->remark,
            'participants' => $followUp->participant_users,
        ];
    }
}
