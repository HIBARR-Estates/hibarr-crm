<?php

namespace App\Notifications;

use App\Models\EmailNotificationSetting;

class TaskLifecycleUpdatedNotification extends TaskLifecycleBaseNotification
{
    protected function resolveEmailSetting(): ?EmailNotificationSetting
    {
        return EmailNotificationSetting::where('company_id', $this->company->id)
            ->where('slug', 'user-assign-to-task')
            ->first();
    }

    protected function eventType(): string
    {
        return 'updated';
    }

    protected function mailSubject(): string
    {
        return __('email.taskUpdate.subject');
    }

    protected function mailView(): string
    {
        return 'mail.task.updated';
    }

    protected function mailContent($notifiable): string
    {
        $taskShortCode = $this->task->task_short_code ? '#' . $this->task->task_short_code : ' ';

        return __('email.taskUpdate.text') . ' <br><br>' . $this->task->heading . ' - ' . $taskShortCode . ' <br><br>' . __('email.taskUpdate.text2');
    }
}
