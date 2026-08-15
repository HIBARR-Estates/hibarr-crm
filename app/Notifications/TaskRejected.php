<?php

namespace App\Notifications;

use App\Models\Task;
use App\Models\User;
use App\Support\EntityActivityMailBuilder;

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
        return '';
    }

    protected function mailIntro($notifiable): string
    {
        $rejectedByName = $this->rejectedBy?->name ?? __('app.system');

        return __('email.taskRejected.text').' '.__('email.taskRejected.rejectedBy').': '.$rejectedByName.'.';
    }

    protected function mailSupplementalContent($notifiable): string
    {
        $reason = $this->safeMailText(strip_tags($this->reason), 500);
        if ($reason === '') {
            return '';
        }

        $line = EntityActivityMailBuilder::supplementalLine(__('email.taskRejected.reason'), $reason);

        return $line !== '' ? '<div class="callout">'.$line.'</div>' : '';
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
