<?php

namespace App\Services\Reminders;

use App\Models\DealFollowUp;
use App\Models\Reminder;
use App\Models\User;
use App\Support\ReminderFeature;
use Illuminate\Support\Collection;

/**
 * Bridges DealFollowUp meeting writes to ReminderCreator (explicit, not observer).
 */
class MeetingReminderSync
{
    public function __construct(
        private readonly ReminderCreator $creator
    ) {
    }

    public function syncFromFollowUp(DealFollowUp $followUp): void
    {
        $companyId = $this->resolveCompanyId($followUp);
        if ($companyId === null || !ReminderFeature::enabledForCompany($companyId)) {
            return;
        }

        if (($followUp->send_reminder ?? 'yes') !== 'yes' || !$followUp->next_follow_up_date) {
            $this->creator->cancelOpenForEntity(Reminder::ENTITY_MEETING, (int) $followUp->id);

            return;
        }

        $recipients = $this->buildRecipients($followUp);
        if ($recipients === []) {
            $this->creator->cancelOpenForEntity(Reminder::ENTITY_MEETING, (int) $followUp->id);

            return;
        }

        // Only force cadence when the meeting has explicit custom reminders;
        // otherwise ReminderCreator resolves user prefs → entity defaults.
        $cadence = null;
        if (!empty($followUp->reminders)) {
            $offsets = array_merge(DealFollowUp::DEFAULT_REMINDERS, $followUp->reminders);
            $cadence = $this->creator->offsetsToMinutes($offsets);
        }

        $this->creator->rebuildForEntity(
            $companyId,
            Reminder::ENTITY_MEETING,
            (int) $followUp->id,
            $followUp->next_follow_up_date,
            $recipients,
            $cadence,
            [
                'message' => $followUp->remark,
                'created_by' => $followUp->added_by,
                'added_by' => $followUp->added_by,
            ]
        );
    }

    public function cancelForFollowUp(DealFollowUp $followUp): void
    {
        $companyId = $this->resolveCompanyId($followUp);
        if ($companyId === null || !ReminderFeature::enabledForCompany($companyId)) {
            return;
        }

        $this->creator->cancelOpenForEntity(Reminder::ENTITY_MEETING, (int) $followUp->id);
    }

    /**
     * @return array<int, array{type: string, id?: int|null, email?: string|null}>
     */
    private function buildRecipients(DealFollowUp $followUp): array
    {
        $userIds = collect($followUp->participants ?? [])
            ->map(fn ($id) => (int) $id)
            ->filter()
            ->values();

        $followUp->loadMissing(['deal.leadAgent.user', 'deal.contact', 'lead']);

        $agentUserId = $followUp->deal?->leadAgent?->user_id
            ?? $followUp->lead?->lead_owner
            ?? null;

        if ($agentUserId) {
            $userIds->push((int) $agentUserId);
        }

        if ($followUp->added_by) {
            $userIds->push((int) $followUp->added_by);
        }

        $uniqueUserIds = $userIds->unique()->values();
        $emails = User::query()
            ->whereIn('id', $uniqueUserIds)
            ->pluck('email', 'id');

        $recipients = [];
        foreach ($uniqueUserIds as $userId) {
            $email = $emails->get($userId);
            if (!is_string($email) || $email === '') {
                continue;
            }
            $recipients[] = [
                'type' => Reminder::RECIPIENT_USER,
                'id' => $userId,
                'email' => $email,
            ];
        }

        // The lead the meeting was created for also gets a (differently worded,
        // customer-facing) reminder, if they have an email on file.
        $lead = $followUp->lead ?? $followUp->deal?->contact;
        if ($lead) {
            $leadEmail = $lead->client_email ?? $lead->email ?? null;
            if (is_string($leadEmail) && $leadEmail !== '') {
                $recipients[] = [
                    'type' => Reminder::RECIPIENT_LEAD,
                    'id' => (int) $lead->id,
                    'email' => $leadEmail,
                ];
            }
        }

        return $recipients;
    }

    private function resolveCompanyId(DealFollowUp $followUp): ?int
    {
        $followUp->loadMissing(['deal', 'lead']);

        $companyId = $followUp->deal?->company_id ?? $followUp->lead?->company_id;

        return $companyId ? (int) $companyId : null;
    }
}
