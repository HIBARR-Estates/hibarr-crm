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
        $updatedByName = $this->updatedBy?->name ?? __('app.system');
        $oldLabel = $this->oldPriority
            ? __('modules.tasks.'.strtolower($this->oldPriority))
            : __('app.na');
        $newLabel = __('modules.tasks.'.strtolower((string) $this->task->priority));

        return __('email.taskPriorityUpdated.text').'<br>'
            .__('email.taskUpdate.updatedBy').': '.$updatedByName.'<br>'
            .__('modules.tasks.priority').': '.$oldLabel.' → '.$newLabel.'<br>'
            .__('app.task').': '.$this->task->heading.'<br>'
            .$this->projectLine();
    }

    protected function actionText(): string
    {
        return __('email.taskPriorityUpdated.action');
    }
}
