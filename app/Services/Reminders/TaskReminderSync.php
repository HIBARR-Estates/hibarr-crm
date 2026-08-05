<?php

namespace App\Services\Reminders;

use App\Models\Reminder;
use App\Models\Task;
use App\Services\TaskVisibilityService;
use App\Support\ReminderFeature;

/**
 * Task reminders use the task's dynamic remind_at (not due_date).
 */
class TaskReminderSync
{
    public function __construct(
        private readonly ReminderCreator $creator
    ) {
    }

    public function syncFromTask(Task $task): void
    {
        $companyId = $task->company_id ? (int) $task->company_id : null;
        if ($companyId === null || ! ReminderFeature::enabledForCompany($companyId)) {
            return;
        }

        $eventAt = ReminderEventAt::fromDateTime($task->remind_at ?? null);
        if ($eventAt === null || $this->isCompleted($task)) {
            $this->creator->cancelOpenForEntity(Reminder::ENTITY_TASK, (int) $task->id);

            return;
        }

        $recipients = $this->buildRecipients($task);
        if ($recipients === []) {
            $this->creator->cancelOpenForEntity(Reminder::ENTITY_TASK, (int) $task->id);

            return;
        }

        $this->creator->rebuildForEntity(
            $companyId,
            Reminder::ENTITY_TASK,
            (int) $task->id,
            $eventAt,
            $recipients,
            $this->creator->cadenceFromCustomOffsets($task->reminders ?? null),
            [
                'message' => $task->heading,
                'created_by' => $task->created_by ?? $task->added_by,
                'added_by' => $task->added_by,
            ]
        );
    }

    public function cancelForTask(Task $task): void
    {
        $companyId = $task->company_id ? (int) $task->company_id : null;
        if ($companyId === null || ! ReminderFeature::enabledForCompany($companyId)) {
            return;
        }

        $this->creator->cancelOpenForEntity(Reminder::ENTITY_TASK, (int) $task->id);
    }

    /**
     * @return array<int, array{type: string, id?: int|null, email?: string|null}>
     */
    private function buildRecipients(Task $task): array
    {
        $recipients = [];

        foreach (TaskVisibilityService::reminderRecipients($task) as $user) {
            $email = $user->email ?? null;
            if (! is_string($email) || $email === '') {
                continue;
            }

            $recipients[] = [
                'type' => Reminder::RECIPIENT_USER,
                'id' => (int) $user->id,
                'email' => $email,
            ];
        }

        return $recipients;
    }

    private function isCompleted(Task $task): bool
    {
        if ($task->completed_on) {
            return true;
        }

        $task->loadMissing('boardColumn');

        return ($task->boardColumn?->slug ?? '') === 'done';
    }
}
