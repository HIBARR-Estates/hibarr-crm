<?php

namespace App\Services\Reminders;

use App\Models\DealNote;
use App\Models\LeadNote;
use App\Models\Reminder;
use App\Models\User;
use App\Support\ReminderFeature;
use Illuminate\Support\Collection;

/**
 * Bridges DealNote / LeadNote writes to ReminderCreator (explicit, not observer).
 * Reminders are only created when remind_at is set.
 */
class NoteReminderSync
{
    public function __construct(
        private readonly ReminderCreator $creator
    ) {
    }

    public function syncFromDealNote(DealNote $note): void
    {
        $note->loadMissing(['deal.leadAgent.user', 'addedBy']);
        $companyId = $note->deal?->company_id ? (int) $note->deal->company_id : null;
        if ($companyId === null || ! ReminderFeature::enabledForCompany($companyId)) {
            return;
        }

        if (! $note->remind_at) {
            $this->creator->cancelOpenForEntity(Reminder::ENTITY_DEAL_NOTE, (int) $note->id);

            return;
        }

        $recipients = $this->buildDealNoteRecipients($note);
        if ($recipients === []) {
            $this->creator->cancelOpenForEntity(Reminder::ENTITY_DEAL_NOTE, (int) $note->id);

            return;
        }

        $this->creator->rebuildForEntity(
            $companyId,
            Reminder::ENTITY_DEAL_NOTE,
            (int) $note->id,
            $note->remind_at,
            $recipients,
            $this->creator->cadenceFromCustomOffsets($note->reminders ?? null),
            [
                'message' => $note->title,
                'created_by' => $note->added_by,
                'added_by' => $note->added_by,
            ]
        );
    }

    public function syncFromLeadNote(LeadNote $note): void
    {
        $note->loadMissing(['lead', 'addedBy', 'members']);
        $companyId = $note->lead?->company_id ? (int) $note->lead->company_id : null;
        if ($companyId === null || ! ReminderFeature::enabledForCompany($companyId)) {
            return;
        }

        if (! $note->remind_at) {
            $this->creator->cancelOpenForEntity(Reminder::ENTITY_LEAD_NOTE, (int) $note->id);

            return;
        }

        $recipients = $this->buildLeadNoteRecipients($note);
        if ($recipients === []) {
            $this->creator->cancelOpenForEntity(Reminder::ENTITY_LEAD_NOTE, (int) $note->id);

            return;
        }

        $this->creator->rebuildForEntity(
            $companyId,
            Reminder::ENTITY_LEAD_NOTE,
            (int) $note->id,
            $note->remind_at,
            $recipients,
            $this->creator->cadenceFromCustomOffsets($note->reminders ?? null),
            [
                'message' => $note->title,
                'created_by' => $note->added_by,
                'added_by' => $note->added_by,
            ]
        );
    }

    public function cancelForDealNote(DealNote $note): void
    {
        $note->loadMissing('deal');
        $companyId = $note->deal?->company_id ? (int) $note->deal->company_id : null;
        if ($companyId === null || ! ReminderFeature::enabledForCompany($companyId)) {
            return;
        }

        $this->creator->cancelOpenForEntity(Reminder::ENTITY_DEAL_NOTE, (int) $note->id);
    }

    public function cancelForLeadNote(LeadNote $note): void
    {
        $note->loadMissing('lead');
        $companyId = $note->lead?->company_id ? (int) $note->lead->company_id : null;
        if ($companyId === null || ! ReminderFeature::enabledForCompany($companyId)) {
            return;
        }

        $this->creator->cancelOpenForEntity(Reminder::ENTITY_LEAD_NOTE, (int) $note->id);
    }

    /**
     * @return array<int, array{type: string, id?: int|null, email?: string|null}>
     */
    private function buildDealNoteRecipients(DealNote $note): array
    {
        $userIds = collect();

        if ($note->added_by) {
            $userIds->push((int) $note->added_by);
        }

        $agentUserId = $note->deal?->leadAgent?->user_id;
        if ($agentUserId) {
            $userIds->push((int) $agentUserId);
        }

        return $this->usersToRecipients($userIds);
    }

    /**
     * @return array<int, array{type: string, id?: int|null, email?: string|null}>
     */
    private function buildLeadNoteRecipients(LeadNote $note): array
    {
        $userIds = collect();

        if ($note->added_by) {
            $userIds->push((int) $note->added_by);
        }

        if ($note->lead?->lead_owner) {
            $userIds->push((int) $note->lead->lead_owner);
        }

        // Private notes: include shared members
        if ((int) ($note->type ?? 0) === 1) {
            foreach ($note->members as $member) {
                if ($member->user_id) {
                    $userIds->push((int) $member->user_id);
                }
            }
        }

        return $this->usersToRecipients($userIds);
    }

    /**
     * @param  Collection<int, int>  $userIds
     * @return array<int, array{type: string, id?: int|null, email?: string|null}>
     */
    private function usersToRecipients(Collection $userIds): array
    {
        $uniqueUserIds = $userIds->filter()->unique()->values();
        if ($uniqueUserIds->isEmpty()) {
            return [];
        }

        $emails = User::query()
            ->whereIn('id', $uniqueUserIds)
            ->pluck('email', 'id');

        $recipients = [];
        foreach ($uniqueUserIds as $userId) {
            $email = $emails->get($userId);
            if (! is_string($email) || $email === '') {
                continue;
            }
            $recipients[] = [
                'type' => Reminder::RECIPIENT_USER,
                'id' => (int) $userId,
                'email' => $email,
            ];
        }

        return $recipients;
    }
}
