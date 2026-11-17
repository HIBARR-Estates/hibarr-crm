<?php

namespace App\Http\Controllers;

use App\Enums\MeetingAttendanceOutcome;
use App\Models\Company;
use App\Models\DealFollowUp;
use App\Services\AgentWorkspace\ContactDeals;
use App\Services\AgentWorkspace\LeadVisibility;
use App\Services\MeetingAttendanceConfirmationService;
use App\Support\MeetingAttendanceConfirmationFeature;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MeetingAttendanceConfirmationController extends Controller
{
    public function __construct(
        private readonly MeetingAttendanceConfirmationService $service,
    ) {}

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
            // How long a snooze hides a meeting, so a screen can say "until 14:30" before it is pressed.
            'snooze_minutes' => $this->snoozeMinutes(),
        ]);
    }

    public function confirm(Request $request, DealFollowUp $followUp): JsonResponse
    {
        // The prompt is only *sent* to the assignee, but anyone who can see
        // the meeting may answer it — same rule as update(). Gating on
        // authorizedFor() alone 403'd people the pending list had shown it
        // to (e.g. a lead owner whose lead's deal has a different agent).
        if (! $this->authorizedFor($followUp) && ! $this->canSeeMeeting($followUp)) {
            return response()->json([
                'status' => 'fail',
                'message' => 'You do not have permission to confirm this meeting.',
            ], 403);
        }

        $validated = $request->validate([
            'outcome' => ['required', 'string', 'in:'.implode(',', array_column(MeetingAttendanceOutcome::cases(), 'value'))],
            'note' => ['nullable', 'string', 'max:2000'],
        ]);

        $outcome = MeetingAttendanceOutcome::from($validated['outcome']);

        $followUp = $this->service->confirm($followUp, user(), $outcome, $validated['note'] ?? null);

        // confirm() no-ops on a meeting that isn't eligible (feature off, not
        // ended long enough ago, cancelled, pre-activation). Say so instead
        // of reporting a save that didn't happen — the dock would otherwise
        // drop the card and the next poll would bring it straight back.
        if (! $followUp->attendance_outcome_logged_at) {
            return response()->json([
                'status' => 'fail',
                'message' => 'This meeting can\'t be confirmed yet. Try again once it has ended.',
            ], 422);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Meeting outcome saved.',
            'data' => [
                'id' => $followUp->id,
                'attendance_outcome' => $followUp->attendance_outcome,
            ],
        ]);
    }

    /**
     * Sets or changes a meeting's outcome from the meeting's own show/edit
     * view (not the Check-ins dock, which goes through confirm()).
     *
     * Anyone who can see the meeting may record what happened — the
     * outcome is stamped with who logged it (attendance_outcome_logged_by)
     * and the timeline event names them, so there's no need to restrict it
     * to the host. The Check-ins prompt stays assignee-only: that rule is
     * about who gets nagged, not who may answer.
     */
    public function update(Request $request, DealFollowUp $followUp): JsonResponse
    {
        if (! $this->canSeeMeeting($followUp)) {
            return response()->json([
                'status' => 'fail',
                'message' => 'You do not have permission to record an outcome for this meeting.',
            ], 403);
        }

        $validated = $request->validate([
            'outcome' => ['required', 'string', 'in:'.implode(',', array_column(MeetingAttendanceOutcome::cases(), 'value'))],
            'note' => ['nullable', 'string', 'max:2000'],
        ]);

        // A cancelled meeting's outcome is known the moment it's cancelled —
        // same exception the panel makes client-side. An outcome that's
        // already logged stays correctable too: saving any non-cancelled
        // outcome on a future cancelled meeting flips its status to
        // `completed` (followUpStatus()), which would otherwise lock it until
        // the original slot passes.
        if ($followUp->status !== 'cancelled'
            && ! $followUp->attendance_outcome_logged_at
            && $followUp->next_follow_up_date && $followUp->next_follow_up_date->isFuture()) {
            return response()->json([
                'status' => 'fail',
                'message' => 'A meeting outcome can only be recorded once the meeting has started.',
            ], 422);
        }

        $outcome = MeetingAttendanceOutcome::from($validated['outcome']);

        $followUp = $this->service->update($followUp, user(), $outcome, $validated['note'] ?? null);

        return response()->json([
            'status' => 'success',
            'message' => 'Meeting outcome saved.',
            'data' => [
                'id' => $followUp->id,
                'attendance_outcome' => $followUp->attendance_outcome,
                'attendance_outcome_logged_at' => $followUp->attendance_outcome_logged_at?->toIso8601String(),
                'attendance_outcome_logged_by' => $followUp->attendance_outcome_logged_by,
                'outcome_logged_by' => $followUp->outcomeLoggedBy()->first(['id', 'name', 'image']),
            ],
        ]);
    }

    public function snooze(Request $request, DealFollowUp $followUp): JsonResponse
    {
        if (! $this->authorizedFor($followUp)) {
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

    /**
     * Whether the current user can see $followUp anywhere it's shown: on the
     * meetings list (creator/participant), as its host or confirmation
     * assignee, or through the deal/lead page it belongs to. Always scoped to
     * the user's own company — DealFollowUp carries no CompanyScope.
     */
    private function canSeeMeeting(DealFollowUp $followUp): bool
    {
        $user = user();
        $companyId = $user->company_id ? (int) $user->company_id : null;

        if ($companyId === null || ! $followUp->belongsToCompany($companyId)) {
            return false;
        }

        $userId = (int) $user->id;

        if ($followUp->isVisibleToUser($userId)
            || (int) $followUp->host_id === $userId
            || $followUp->confirmationAssigneeUserId() === $userId) {
            return true;
        }

        if ($user->permission('view_lead_follow_up') === 'none') {
            return false;
        }

        if ($followUp->deal && ContactDeals::canView($user, $followUp->deal)) {
            return true;
        }

        return $followUp->lead !== null && LeadVisibility::canView($user, $followUp->lead);
    }

    private function snoozeMinutes(): int
    {
        $company = company();

        return $company instanceof Company
            ? MeetingAttendanceConfirmationFeature::snoozeMinutes($company)
            : 60;
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
