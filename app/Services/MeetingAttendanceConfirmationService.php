<?php

namespace App\Services;

use App\Enums\MeetingAttendanceOutcome;
use App\Models\Company;
use App\Models\Deal;
use App\Models\DealFollowUp;
use App\Models\DealNote;
use App\Models\LeadNote;
use App\Models\User;
use App\Support\MeetingAttendanceConfirmationFeature;
use Illuminate\Support\Facades\DB;

class MeetingAttendanceConfirmationService
{
    public function __construct(
        private readonly DealActivityEventService $dealActivityEventService,
    ) {
    }

    /**
     * The oldest meeting assigned to $user that's still awaiting an attendance
     * outcome, which started at/after the company's activation cutoff (a
     * meeting already on the calendar before the feature was turned on is
     * never eligible, no matter when it happens to end), and whose computed
     * end time is at least the configured delay in the past. Returns null
     * when nothing is eligible (feature off, not yet activated, or no
     * qualifying meeting).
     */
    public function pendingForUser(User $user): ?DealFollowUp
    {
        $companyId = $user->company_id ? (int) $user->company_id : null;
        if (!$companyId) {
            return null;
        }

        $company = Company::find($companyId);
        if (!$company || !MeetingAttendanceConfirmationFeature::enabledForCompany($company)) {
            return null;
        }

        $activatedAt = $company->meeting_attendance_confirmation_enabled_at;
        if (!$activatedAt) {
            return null;
        }

        $cutoff = now()->subMinutes(MeetingAttendanceConfirmationFeature::delayMinutes());

        $candidates = DealFollowUp::query()
            ->whereNull('attendance_outcome_logged_at')
            ->where(function ($query) {
                $query->whereNull('status')
                    ->orWhere('status', '!=', 'cancelled');
            })
            ->whereNotNull('next_follow_up_date')
            // A meeting that started before the feature was activated for this
            // company is "existing" and must never be prompted — regardless of
            // when it happens to end.
            ->where('next_follow_up_date', '>=', $activatedAt)
            ->where('next_follow_up_date', '<=', now())
            ->where(function ($query) use ($user, $companyId) {
                $query->whereHas('deal', function ($dealQuery) use ($user, $companyId) {
                    $dealQuery->where('company_id', $companyId)
                        ->whereHas('leadAgent', function ($agentQuery) use ($user) {
                            $agentQuery->where('user_id', $user->id);
                        });
                })->orWhereHas('lead', function ($leadQuery) use ($user, $companyId) {
                    $leadQuery->where('company_id', $companyId)
                        ->where('lead_owner', $user->id);
                });
            })
            ->with(['deal.leadAgent', 'deal.contact', 'lead', 'meetingType'])
            ->orderBy('next_follow_up_date')
            ->limit(20)
            ->get();

        foreach ($candidates as $followUp) {
            $endTime = $followUp->getEndTime();

            // duration is per-row and defaults in PHP (not SQL), so the
            // "ended at least $delay ago" check happens here.
            if (!$endTime || $endTime->gt($cutoff)) {
                continue;
            }

            return $followUp;
        }

        return null;
    }

    public function confirm(
        DealFollowUp $followUp,
        User $user,
        MeetingAttendanceOutcome $outcome,
        ?string $note
    ): DealFollowUp {
        $trimmedNote = $note !== null ? trim($note) : '';

        return DB::transaction(function () use ($followUp, $user, $outcome, $trimmedNote) {
            $loggedAt = now();

            $claimed = DealFollowUp::query()
                ->whereKey($followUp->id)
                ->whereNull('attendance_outcome_logged_at')
                ->update([
                    'attendance_outcome' => $outcome->value,
                    'attendance_outcome_logged_at' => $loggedAt,
                    'attendance_outcome_logged_by' => $user->id,
                    'status' => $outcome->followUpStatus(),
                ]);

            if ($claimed === 0) {
                return $followUp->fresh();
            }

            $followUp->refresh();
            $followUp->loadMissing(['deal.contact', 'lead', 'meetingType']);

            $timezone = $user->timezone
                ?: Company::find($user->company_id)?->timezone
                ?: config('app.timezone');
            $deal = $followUp->deal;

            if ($deal) {
                $createdNote = $trimmedNote !== '' ? $this->createDealNote($deal, $followUp, $trimmedNote, $timezone) : null;

                $this->dealActivityEventService->recordMeetingOutcomeLogged(
                    $deal,
                    $followUp,
                    $outcome,
                    $createdNote?->id
                );
            } elseif ($followUp->lead_id && $trimmedNote !== '') {
                // No deal linked — the remark goes on the lead instead. There's no
                // lead-side equivalent of DealActivityEventService's CrmEvent
                // timeline to record the outcome-change itself against.
                $this->createLeadNote($followUp, $trimmedNote, $timezone);
            }

            return $followUp;
        });
    }

    /**
     * Remarks left when confirming an outcome are regular deal notes — the
     * existing DealNoteObserver already records the `deal_note_added` timeline
     * entry and notifies watchers, the same as the Notes tab's "Add Note".
     */
    private function createDealNote(Deal $deal, DealFollowUp $followUp, string $details, string $timezone): DealNote
    {
        $contactName = $deal->contact?->client_name ?? $followUp->lead?->client_name;

        return DealNote::create([
            'title' => $this->remarkTitle($contactName, $followUp, $timezone),
            'deal_id' => $deal->id,
            'details' => $details,
        ]);
    }

    /**
     * Lead-only follow-ups (no linked deal) get a regular lead note instead —
     * LeadNoteObserver notifies the same way DealNoteObserver does for deals.
     */
    private function createLeadNote(DealFollowUp $followUp, string $details, string $timezone): LeadNote
    {
        $contactName = $followUp->lead?->client_name;

        return LeadNote::create([
            'title' => $this->remarkTitle($contactName, $followUp, $timezone),
            'lead_id' => $followUp->lead_id,
            'details' => $details,
        ]);
    }

    private function remarkTitle(?string $contactName, DealFollowUp $followUp, string $timezone): string
    {
        // MeetingType's display column is `name` (e.g. "Strategy Meeting"), not `type`.
        $meetingTypeName = trim((string) ($followUp->meetingType?->name ?? ''));
        $meetingLabel = $meetingTypeName !== '' ? "{$meetingTypeName} meeting" : 'meeting';

        $suffix = $followUp->next_follow_up_date
            ? ' — ' . $followUp->next_follow_up_date->copy()->setTimezone($timezone)->format('M j, Y')
            : '';

        return $contactName
            ? "Remark after {$meetingLabel} with {$contactName}{$suffix}"
            : "Remark after {$meetingLabel}{$suffix}";
    }
}
