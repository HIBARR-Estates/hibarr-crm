<?php

namespace App\Notifications;

use App\Models\Task;
use App\Models\User;

class TaskPriorityUpdated extends TaskAssigneeNotification
{
    private ?string $oldPriority;

    private ?User $updatedBy;

    public function __construct(Task $task, ?string $oldPriority = null, ?User $updatedBy = null)
    {
        $this->oldPriority = $oldPriority;
        $this->updatedBy = $updatedBy;
        parent::__construct($task, 'task-priority-updated');
    }

    protected function pushTitle(): string
    {
        return __('email.taskPriorityUpdated.subject');
    }

    protected function mailSubject(): string
    {
        return __('email.taskPriorityUpdated.subject').$this->taskShortCode().'- '.config('app.name').'.';
    }

    protected function mailContent($notifiable): string
    {
        $updatedByName = $this->safeMailText($this->updatedBy?->name ?? __('app.system'), 100);
        $oldLabel = $this->oldPriority
            ? __('modules.tasks.'.strtolower($this->oldPriority))
            : __('app.na');
        $newLabel = $this->task->priority
            ? __('modules.tasks.'.strtolower((string) $this->task->priority))
            : __('app.na');

        return __('email.taskPriorityUpdated.text').'<br>'
            .__('email.taskUpdate.updatedBy').': '.$updatedByName.'<br>'
            .__('modules.tasks.priority').': '.$oldLabel.' → '.$newLabel.'<br>'
            .__('app.task').': '.$this->safeMailText($this->task->heading, 200).'<br>'
            .$this->projectLine();
    }

    protected function actionText(): string
    {
        return __('email.taskPriorityUpdated.action');
    }
}
