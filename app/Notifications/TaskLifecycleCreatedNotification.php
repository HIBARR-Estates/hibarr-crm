<?php

namespace App\Notifications;

use App\Models\EmailNotificationSetting;

class TaskLifecycleCreatedNotification extends TaskLifecycleBaseNotification
{
    protected function resolveEmailSetting(): ?EmailNotificationSetting
    {
        return EmailNotificationSetting::userAssignTask();
    }

    protected function eventType(): string
    {
        return 'created';
    }

    protected function mailSubject(): string
    {
        return __('email.newTask.subject');
    }

    protected function mailView(): string
    {
        return 'mail.task.created';
    }

    protected function mailContent($notifiable): string
    {
        $dueDate = $this->task->due_date
            ? $this->task->due_date->format($this->company->date_format)
            : null;
        $taskShortCode = $this->task->task_short_code ? '#' . $this->task->task_short_code . ' - ' : '';

        return $this->task->heading . ' ' . $taskShortCode . '<p>
            <b style="color: green">' . __('app.dueDate') . ': ' . $dueDate . '</b>
        </p>';
    }
}
