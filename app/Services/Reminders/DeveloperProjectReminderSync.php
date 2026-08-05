<?php

namespace App\Services\Reminders;

use App\Models\DeveloperProject;
use App\Models\Reminder;
use App\Support\ReminderFeature;

/**
 * Developer project reminders use dynamic remind_at (not completion_date).
 */
class DeveloperProjectReminderSync
{
    use BuildsUserReminderRecipients;

    public function __construct(
        private readonly ReminderCreator $creator
    ) {
    }

    public function syncFromProject(DeveloperProject $project): void
    {
        $companyId = $project->company_id ? (int) $project->company_id : null;
        if ($companyId === null || ! ReminderFeature::enabledForCompany($companyId)) {
            return;
        }

        $eventAt = ReminderEventAt::fromDateTime($project->remind_at ?? null);
        if ($eventAt === null) {
            $this->creator->cancelOpenForEntity(Reminder::ENTITY_DEVELOPER_PROJECT, (int) $project->id);

            return;
        }

        $recipients = $this->buildRecipients($project);
        if ($recipients === []) {
            $this->creator->cancelOpenForEntity(Reminder::ENTITY_DEVELOPER_PROJECT, (int) $project->id);

            return;
        }

        $this->creator->rebuildForEntity(
            $companyId,
            Reminder::ENTITY_DEVELOPER_PROJECT,
            (int) $project->id,
            $eventAt,
            $recipients,
            $this->creator->cadenceFromCustomOffsets($project->reminders ?? null),
            [
                'message' => $project->name ?? 'Project',
                'created_by' => $project->added_by ?? auth()->id(),
                'added_by' => $project->added_by ?? auth()->id(),
            ]
        );
    }

    public function cancelForProject(DeveloperProject $project): void
    {
        $companyId = $project->company_id ? (int) $project->company_id : null;
        if ($companyId === null || ! ReminderFeature::enabledForCompany($companyId)) {
            return;
        }

        $this->creator->cancelOpenForEntity(Reminder::ENTITY_DEVELOPER_PROJECT, (int) $project->id);
    }

    /**
     * @return array<int, array{type: string, id?: int|null, email?: string|null}>
     */
    private function buildRecipients(DeveloperProject $project): array
    {
        $userIds = collect();
        if (! empty($project->added_by)) {
            $userIds->push((int) $project->added_by);
        }
        if (! empty($project->created_by)) {
            $userIds->push((int) $project->created_by);
        }
        if ($userIds->isEmpty() && auth()->id()) {
            $userIds->push((int) auth()->id());
        }

        return $this->usersToRecipients($userIds);
    }
}
