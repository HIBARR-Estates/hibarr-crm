<?php

namespace App\Services\Reminders;

use App\Models\DeveloperProjectUnitType;
use App\Models\Reminder;
use App\Support\ReminderFeature;

/**
 * Unit (DeveloperProjectUnitType) reminders use dynamic remind_at (not completion_date).
 */
class UnitReminderSync
{
    use BuildsUserReminderRecipients;

    public function __construct(
        private readonly ReminderCreator $creator
    ) {
    }

    public function syncFromUnitType(DeveloperProjectUnitType $unitType): void
    {
        $companyId = $unitType->company_id ? (int) $unitType->company_id : null;
        if ($companyId === null || ! ReminderFeature::enabledForCompany($companyId)) {
            return;
        }

        $eventAt = ReminderEventAt::fromDateTime($unitType->remind_at ?? null);
        if ($eventAt === null) {
            $this->creator->cancelOpenForEntity(Reminder::ENTITY_UNIT, (int) $unitType->id);

            return;
        }

        $recipients = $this->buildRecipients($unitType);
        if ($recipients === []) {
            $this->creator->cancelOpenForEntity(Reminder::ENTITY_UNIT, (int) $unitType->id);

            return;
        }

        $this->creator->rebuildForEntity(
            $companyId,
            Reminder::ENTITY_UNIT,
            (int) $unitType->id,
            $eventAt,
            $recipients,
            $this->creator->cadenceFromCustomOffsets($unitType->reminders ?? null),
            [
                'message' => $unitType->display_label ?? $unitType->reference_code ?? 'Unit',
                'created_by' => $unitType->added_by ?? auth()->id(),
                'added_by' => $unitType->added_by ?? auth()->id(),
            ]
        );
    }

    public function cancelForUnitType(DeveloperProjectUnitType $unitType): void
    {
        $companyId = $unitType->company_id ? (int) $unitType->company_id : null;
        if ($companyId === null || ! ReminderFeature::enabledForCompany($companyId)) {
            return;
        }

        $this->creator->cancelOpenForEntity(Reminder::ENTITY_UNIT, (int) $unitType->id);
    }

    /**
     * @return array<int, array{type: string, id?: int|null, email?: string|null}>
     */
    private function buildRecipients(DeveloperProjectUnitType $unitType): array
    {
        $unitType->loadMissing('project');

        $userIds = collect();
        if (! empty($unitType->added_by)) {
            $userIds->push((int) $unitType->added_by);
        }
        if (! empty($unitType->project?->added_by)) {
            $userIds->push((int) $unitType->project->added_by);
        }
        if (! empty($unitType->project?->created_by)) {
            $userIds->push((int) $unitType->project->created_by);
        }
        if ($userIds->isEmpty() && auth()->id()) {
            $userIds->push((int) auth()->id());
        }

        return $this->usersToRecipients($userIds);
    }
}
