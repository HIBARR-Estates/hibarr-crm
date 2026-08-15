<?php

namespace App\Notifications;

use App\Models\Task;
use App\Models\User;

class TaskDeleted extends TaskAssigneeNotification
{
    private ?User $deletedBy;

    public function __construct(Task $task, ?User $deletedBy = null)
    {
        $this->deletedBy = $deletedBy;
        parent::__construct($task, 'task-deleted');
    }

    protected function pushTitle(): string
    {
        return __('email.taskDeleted.subject');
    }

    protected function mailSubject(): string
    {
        return __('email.taskDeleted.subject').$this->taskShortCode().'- '.config('app.name').'.';
    }

    protected function mailContent($notifiable): string
    {
        $deletedByName = $this->deletedBy?->name ?? __('app.system');

        return __('email.taskDeleted.text').'<br>'
            .__('email.taskUpdate.updatedBy').': '.$deletedByName.'<br>'
            .__('app.task').': '.$this->task->heading.'<br>'
            .$this->projectLine();
    }

    protected function actionText(): string
    {
        return __('email.taskDeleted.action');
    }
}
