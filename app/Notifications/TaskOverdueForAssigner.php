<?php

namespace App\Notifications;

use App\Models\Task;
use App\Support\EntityActivityMailBuilder;

/**
 * Overdue-task notice sent to the project admin / assignee's manager — distinct
 * from TaskOverdue (sent to the assignee) so each recipient gets a message
 * tailored to their relationship to the task rather than identical copy.
 */
class TaskOverdueForAssigner extends TaskAssigneeNotification
{
    private int $daysOverdue;

    private string $assigneeNames;

    public function __construct(Task $task, int $daysOverdue, string $assigneeNames)
    {
        $this->daysOverdue = max(1, $daysOverdue);
        $this->assigneeNames = $assigneeNames;
        parent::__construct($task, 'task-overdue');
    }

    protected function pushTitle(): string
    {
        return __('email.taskOverdue.assignerSubject');
    }

    protected function mailSubject(): string
    {
        return __('email.taskOverdue.assignerSubject').$this->taskShortCode().'- '.config('app.name').'.';
    }

    protected function mailContent($notifiable): string
    {
        return '';
    }

    protected function mailIntro($notifiable): string
    {
        return __('email.taskOverdue.assignerText', [
            'assignee' => $this->assigneeNames,
            'days' => $this->daysOverdue,
        ]);
    }

    protected function mailDetailHtml($notifiable): string
    {
        $dateFormat = $this->company?->date_format ?? 'Y-m-d';
        $dueDate = $this->task->due_date
            ? $this->task->due_date->copy()->timezone($this->company?->timezone ?: 'UTC')->format($dateFormat)
            : __('app.na');

        return EntityActivityMailBuilder::renderDetailBlock(
            $dueDate,
            $this->safeMailText($this->task->heading, 200),
            $this->taskMetaLine(),
        );
    }

    protected function actionText(): string
    {
        return __('email.taskOverdue.action');
    }

    /**
     * @param  mixed  $notifiable
     * @return array<string, mixed>
     */
    public function toArray($notifiable): array
    {
        return array_merge(parent::toArray($notifiable), [
            'days_overdue' => $this->daysOverdue,
            'assignee_names' => $this->assigneeNames,
        ]);
    }
}
