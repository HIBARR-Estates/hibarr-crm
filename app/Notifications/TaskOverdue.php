<?php

namespace App\Notifications;

use App\Models\Task;

class TaskOverdue extends TaskAssigneeNotification
{
    private int $daysOverdue;

    public function __construct(Task $task, int $daysOverdue)
    {
        $this->daysOverdue = max(1, $daysOverdue);
        parent::__construct($task, 'task-overdue');
    }

    protected function pushTitle(): string
    {
        return __('email.taskOverdue.subject');
    }

    protected function mailSubject(): string
    {
        return __('email.taskOverdue.subject').$this->taskShortCode().'- '.config('app.name').'.';
    }

    protected function mailContent($notifiable): string
    {
        $dateFormat = $this->company?->date_format ?? 'Y-m-d';
        $dueDate = $this->task->due_date
            ? $this->task->due_date->copy()->timezone($this->company?->timezone ?: 'UTC')->format($dateFormat)
            : __('app.na');

        return __('email.taskOverdue.text', ['days' => $this->daysOverdue]).'<br>'
            .__('app.task').': '.$this->safeMailText($this->task->heading, 200).'<br>'
            .__('app.dueDate').': '.$dueDate.'<br>'
            .$this->projectLine();
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
        ]);
    }
}
