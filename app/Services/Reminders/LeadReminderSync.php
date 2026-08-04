<?php

namespace App\Services\Reminders;

use App\Models\Lead;
use App\Models\Reminder;
use App\Support\ReminderFeature;

class LeadReminderSync
{
    use BuildsUserReminderRecipients;

    public function __construct(
        private readonly ReminderCreator $creator
    ) {
    }

    public function syncFromLead(Lead $lead): void
    {
        $companyId = $lead->company_id ? (int) $lead->company_id : null;
        if ($companyId === null || ! ReminderFeature::enabledForCompany($companyId)) {
            return;
        }

        $eventAt = ReminderEventAt::fromDateTime($lead->remind_at ?? null);
        if ($eventAt === null) {
            $this->creator->cancelOpenForEntity(Reminder::ENTITY_LEAD, (int) $lead->id);

            return;
        }

        $recipients = $this->buildRecipients($lead);
        if ($recipients === []) {
            $this->creator->cancelOpenForEntity(Reminder::ENTITY_LEAD, (int) $lead->id);

            return;
        }

        $this->creator->rebuildForEntity(
            $companyId,
            Reminder::ENTITY_LEAD,
            (int) $lead->id,
            $eventAt,
            $recipients,
            $this->creator->cadenceFromCustomOffsets($lead->reminders ?? null),
            [
                'message' => $lead->client_name ?? $lead->company_name ?? 'Lead',
                'created_by' => $lead->added_by,
                'added_by' => $lead->added_by,
            ]
        );
    }

    public function cancelForLead(Lead $lead): void
    {
        $companyId = $lead->company_id ? (int) $lead->company_id : null;
        if ($companyId === null || ! ReminderFeature::enabledForCompany($companyId)) {
            return;
        }

        $this->creator->cancelOpenForEntity(Reminder::ENTITY_LEAD, (int) $lead->id);
    }

    /**
     * @return array<int, array{type: string, id?: int|null, email?: string|null}>
     */
    private function buildRecipients(Lead $lead): array
    {
        $userIds = collect();
        if ($lead->added_by) {
            $userIds->push((int) $lead->added_by);
        }
        if ($lead->lead_owner) {
            $userIds->push((int) $lead->lead_owner);
        }

        return $this->usersToRecipients($userIds);
    }
}
