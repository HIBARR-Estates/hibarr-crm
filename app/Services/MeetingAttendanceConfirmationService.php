<?php

namespace App\Services;

use App\Enums\MeetingAttendanceOutcome;
use App\Models\Company;
use App\Models\Deal;
use App\Models\DealFollowUp;
use App\Models\DealNote;
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
     * outcome, whose computed end time is at least the configured delay in the
     * past, and which ended at/after the company's activation cutoff. Returns
     * null when nothing is eligible (feature off, not yet activated, or no
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

        // next_follow_up_date <= now() is a cheap SQL-level upper bound (a meeting
        // can't have ended before it started); the precise end-time-plus-delay and
        // activation-cutoff checks happen below via DealFollowUp::getEndTime(),
        // since duration is per-row and defaults in PHP, not SQL.
        $candidates = DealFollowUp::query()
            ->whereNull('attendance_outcome_logged_at')
            ->where(function ($query) {
                $query->whereNull('status')
                    ->orWhere('status', '!=', 'cancelled');
            })
            ->whereNotNull('next_follow_up_date')
            ->where('next_follow_up_date', '<=', now())
            ->where('next_follow_up_date', '>=', $activatedAt)
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

            if (!$endTime || $endTime->gt($cutoff) || $endTime->lt($activatedAt)) {
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

            $deal = $followUp->deal ?? ($followUp->deal_id ? Deal::find($followUp->deal_id) : null);
            if (!$deal) {
                return $followUp;
            }

            $createdNote = $trimmedNote !== '' ? $this->createNote($deal, $followUp, $trimmedNote) : null;

            $this->dealActivityEventService->recordMeetingOutcomeLogged(
                $deal,
                $followUp,
                $outcome,
                $createdNote?->id
            );

            return $followUp;
        });
    }

    /**
     * Remarks left when confirming an outcome are regular deal notes — the
     * existing DealNoteObserver already records the `deal_note_added` timeline
     * entry and notifies watchers, the same as the Notes tab's "Add Note".
     */
    private function createNote(Deal $deal, DealFollowUp $followUp, string $details): DealNote
    {
        $followUp->loadMissing(['deal.contact', 'lead']);

        $contactName = $followUp->deal?->contact?->client_name
            ?? $followUp->lead?->client_name
            ?? null;

        $dateLabel = CrmEventDescriptionBuilder::formatDate($followUp->next_follow_up_date);

        $title = $contactName
            ? "Remark after meeting with {$contactName}" . ($dateLabel !== '--' ? " — {$dateLabel}" : '')
            : "Remark after meeting" . ($dateLabel !== '--' ? " — {$dateLabel}" : '');

        return DealNote::create([
            'title' => $title,
            'deal_id' => $deal->id,
            'details' => $details,
        ]);
    }
}
