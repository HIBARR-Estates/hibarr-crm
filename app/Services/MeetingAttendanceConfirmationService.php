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
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class MeetingAttendanceConfirmationService
{
    public function __construct(
        private readonly DealActivityEventService $dealActivityEventService,
    ) {
    }

    /**
     * Every meeting assigned to $user that's still awaiting an attendance
     * outcome, which started at/after the company's activation cutoff (a
     * meeting already on the calendar before the feature was turned on is
     * never eligible, no matter when it happens to end), whose computed end
     * time is at least the configured delay in the past, and which isn't
     * currently snoozed. Ordered oldest meeting first. Returns an empty
     * collection when nothing is eligible (feature off, not yet activated,
     * or no qualifying meeting).
     *
     * @return Collection<int, DealFollowUp>
     */
    public function pendingListForUser(User $user, int $limit = 20): Collection
    {
        $companyId = $user->company_id ? (int) $user->company_id : null;
        if (!$companyId) {
            return collect();
        }

        $company = Company::find($companyId);
        if (!$company || !MeetingAttendanceConfirmationFeature::enabledForCompany($company)) {
            return collect();
        }

        $activatedAt = $company->meeting_attendance_confirmation_enabled_at;
        if (!$activatedAt) {
            return collect();
        }

        $cutoff = now()->subMinutes(MeetingAttendanceConfirmationFeature::delayMinutes());

        // "Ended at least $delay ago" depends on duration, which defaults in PHP
        // (not SQL) — so it can't be applied as a SQL LIMIT. Ordered ascending by
        // start time (oldest first) and pulled in batches instead: a handful of
        // old, long-running meetings that haven't ended yet must not crowd out an
        // eligible one that started later but was short.
        $batchSize = max($limit, 20);
        $maxScanned = $batchSize * 10;

        $eligible = collect();
        $offset = 0;

        while ($eligible->count() < $limit && $offset < $maxScanned) {
            $batch = $this->pendingCandidatesQuery($user, $companyId, $activatedAt)
                ->skip($offset)
                ->take($batchSize)
                ->get();

            if ($batch->isEmpty()) {
                break;
            }

            foreach ($batch as $followUp) {
                $endTime = $followUp->getEndTime();
                if ($endTime && $endTime->lte($cutoff)) {
                    $eligible->push($followUp);
                    if ($eligible->count() >= $limit) {
                        break;
                    }
                }
            }

            $offset += $batchSize;
        }

        return $eligible->values();
    }

    private function pendingCandidatesQuery(User $user, int $companyId, CarbonInterface $activatedAt)
    {
        return DealFollowUp::query()
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
            ->where(function ($query) {
                $query->whereNull('attendance_confirmation_snoozed_until')
                    ->orWhere('attendance_confirmation_snoozed_until', '<=', now());
            })
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
            ->orderBy('id');
    }

    /**
     * The same eligibility rules pendingListForUser() applies when surfacing a
     * follow-up — reused here so confirm()/snooze() can't be used to act on a
     * future, cancelled, pre-activation, or already-resolved follow-up just
     * because it's assigned to the requesting user. Authorization (company +
     * assignment) is the controller's job; this is the "is it actionable at
     * all right now" check.
     */
    private function isEligibleForOutcomeAction(DealFollowUp $followUp): bool
    {
        if ($followUp->attendance_outcome_logged_at) {
            return false;
        }

        if ($followUp->status === 'cancelled') {
            return false;
        }

        if (!$followUp->next_follow_up_date) {
            return false;
        }

        $followUp->loadMissing(['deal', 'lead']);
        $companyId = $followUp->deal?->company_id ?? $followUp->lead?->company_id;
        $company = $companyId ? Company::find($companyId) : null;

        if (!$company || !MeetingAttendanceConfirmationFeature::enabledForCompany($company)) {
            return false;
        }

        $activatedAt = $company->meeting_attendance_confirmation_enabled_at;
        if (!$activatedAt || $followUp->next_follow_up_date->lt($activatedAt)) {
            return false;
        }

        $cutoff = now()->subMinutes(MeetingAttendanceConfirmationFeature::delayMinutes());
        $endTime = $followUp->getEndTime();

        return $endTime !== null && $endTime->lte($cutoff);
    }

    /**
     * Hides $followUp from the reminders dock until now + $minutes (or the
     * configured default). Passing 0 clears an existing snooze immediately —
     * used by the frontend's "Undo" instead of a separate unsnooze endpoint.
     * A no-op once the meeting's outcome has already been logged.
     */
    public function snooze(DealFollowUp $followUp, ?int $minutes = null): DealFollowUp
    {
        if (!$this->isEligibleForOutcomeAction($followUp)) {
            return $followUp;
        }

        $until = now()->addMinutes($minutes ?? MeetingAttendanceConfirmationFeature::snoozeMinutes());

        DealFollowUp::query()
            ->whereKey($followUp->id)
            ->whereNull('attendance_outcome_logged_at')
            ->update(['attendance_confirmation_snoozed_until' => $until]);

        return $followUp->fresh();
    }

    public function confirm(
        DealFollowUp $followUp,
        User $user,
        MeetingAttendanceOutcome $outcome,
        ?string $note
    ): DealFollowUp {
        if (!$this->isEligibleForOutcomeAction($followUp)) {
            return $followUp;
        }

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
        // Only append "meeting" when the type name doesn't already end with it,
        // so this doesn't read as "Strategy Meeting meeting".
        $meetingTypeName = trim((string) ($followUp->meetingType?->name ?? ''));
        $meetingLabel = match (true) {
            $meetingTypeName === '' => 'meeting',
            (bool) preg_match('/meeting$/i', $meetingTypeName) => $meetingTypeName,
            default => "{$meetingTypeName} meeting",
        };

        $suffix = $followUp->next_follow_up_date
            ? ' — ' . $followUp->next_follow_up_date->copy()->setTimezone($timezone)->format('M j, Y')
            : '';

        return $contactName
            ? "How did the {$meetingLabel} with {$contactName} go{$suffix}?"
            : "How did the {$meetingLabel} go{$suffix}?";
    }
}
