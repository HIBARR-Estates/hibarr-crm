<?php

namespace App\Services\Reminders;

use App\Models\Property;
use App\Models\Reminder;
use App\Support\ReminderFeature;

/**
 * Property reminders use dynamic remind_at (not completion_date).
 */
class PropertyReminderSync
{
    use BuildsUserReminderRecipients;

    public function __construct(
        private readonly ReminderCreator $creator
    ) {
    }

    public function syncFromProperty(Property $property): void
    {
        $companyId = $property->company_id ? (int) $property->company_id : null;
        if ($companyId === null || ! ReminderFeature::enabledForCompany($companyId)) {
            return;
        }

        $eventAt = ReminderEventAt::fromDateTime($property->remind_at ?? null);
        if ($eventAt === null) {
            $this->creator->cancelOpenForEntity(Reminder::ENTITY_PROPERTY, (int) $property->id);

            return;
        }

        $recipients = $this->buildRecipients($property);
        if ($recipients === []) {
            $this->creator->cancelOpenForEntity(Reminder::ENTITY_PROPERTY, (int) $property->id);

            return;
        }

        $this->creator->rebuildForEntity(
            $companyId,
            Reminder::ENTITY_PROPERTY,
            (int) $property->id,
            $eventAt,
            $recipients,
            $this->creator->cadenceFromCustomOffsets($property->reminders ?? null),
            [
                'message' => $property->title ?? 'Property',
                'created_by' => $property->added_by,
                'added_by' => $property->added_by,
            ]
        );
    }

    public function cancelForProperty(Property $property): void
    {
        $companyId = $property->company_id ? (int) $property->company_id : null;
        if ($companyId === null || ! ReminderFeature::enabledForCompany($companyId)) {
            return;
        }

        $this->creator->cancelOpenForEntity(Reminder::ENTITY_PROPERTY, (int) $property->id);
    }

    /**
     * @return array<int, array{type: string, id?: int|null, email?: string|null}>
     */
    private function buildRecipients(Property $property): array
    {
        $userIds = collect();
        if ($property->added_by) {
            $userIds->push((int) $property->added_by);
        }
        if ($property->responsible_agent_id) {
            $userIds->push((int) $property->responsible_agent_id);
        }

        return $this->usersToRecipients($userIds);
    }
}
