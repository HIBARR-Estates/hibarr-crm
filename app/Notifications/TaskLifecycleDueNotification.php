<?php

namespace App\Notifications;

use App\Models\EmailNotificationSetting;

class TaskLifecycleDueNotification extends TaskLifecycleBaseNotification
{
    protected function resolveEmailSetting(): ?EmailNotificationSetting
    {
        return EmailNotificationSetting::userAssignTask();
    }

    protected function eventType(): string
    {
        return 'due';
    }

    protected function mailSubject(): string
    {
        return __('email.taskLifecycle.due.subject');
    }

    protected function mailView(): string
    {
        return 'mail.task.reminder';
    }

    protected function mailContent($notifiable): string
    {
        $dueDate = $this->task->due_date
            ? $this->task->due_date->format($this->company->date_format)
            : null;

        return $this->task->heading . ' #' . $this->task->task_short_code . '<p>
            <b style="color: green">' . __('email.dueOn') . ': ' . $dueDate . '</b>
        </p>';
    }
}
