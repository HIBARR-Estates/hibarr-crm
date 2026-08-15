<?php

namespace App\Notifications;

use App\Models\Task;
use App\Models\User;

class TaskRejected extends TaskAssigneeNotification
{
    private string $reason;

    private ?User $rejectedBy;

    public function __construct(Task $task, string $reason, ?User $rejectedBy = null)
    {
        $this->reason = $reason;
        $this->rejectedBy = $rejectedBy;
        parent::__construct($task, 'task-rejected');
    }

    protected function pushTitle(): string
    {
        return __('email.taskRejected.subject');
    }

    protected function mailSubject(): string
    {
        return __('email.taskRejected.subject').$this->taskShortCode().'- '.config('app.name').'.';
    }

    protected function mailContent($notifiable): string
    {
        $rejectedByName = $this->rejectedBy?->name ?? __('app.system');

        return __('email.taskRejected.text').'<br>'
            .__('email.taskRejected.rejectedBy').': '.$rejectedByName.'<br>'
            .__('email.taskRejected.reason').': '.strip_tags($this->reason).'<br>'
            .__('app.task').': '.$this->task->heading.'<br>'
            .$this->projectLine();
    }

    protected function actionText(): string
    {
        return __('email.taskRejected.action');
    }

    /**
     * @param  mixed  $notifiable
     * @return array<string, mixed>
     */
    public function toArray($notifiable): array
    {
        return array_merge(parent::toArray($notifiable), [
            'reason' => $this->reason,
        ]);
    }
}
