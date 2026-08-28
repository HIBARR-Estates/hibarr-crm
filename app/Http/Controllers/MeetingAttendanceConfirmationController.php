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
        DealFollowUp::attachParticipantUsers($followUps);

        return response()->json([
            'status' => 'success',
            'message' => '',
            'data' => $followUps->map(fn (DealFollowUp $followUp) => $this->present($followUp))->values(),
        ]);
    }

    public function confirm(Request $request, DealFollowUp $followUp): JsonResponse
    {
        if (!$this->authorizedFor($followUp)) {
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
        if (!$this->authorizedFor($followUp)) {
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

    /**
     * $followUp must belong to the current user's company (this model has no
     * automatic CompanyScope, so route-model binding by ID alone doesn't
     * enforce that) AND be assigned to them specifically — the meeting's
     * host when one applies, otherwise the same deal-agent/lead-owner
     * fallback pendingListForUser() uses. Must stay in sync with that
     * method's own "assigned to this user" query, or a user could see the
     * confirmation prompt but get a 403 confirming it (or vice versa).
     */
    private function authorizedFor(DealFollowUp $followUp): bool
    {
        $companyId = user()->company_id ? (int) user()->company_id : null;

        return $companyId !== null
            && $followUp->belongsToCompany($companyId)
            && $followUp->confirmationAssigneeUserId() === (int) user()->id;
    }

    private function present(DealFollowUp $followUp): array
    {
        $followUp->loadMissing(['deal.contact', 'lead', 'meetingType']);

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
