<?php

namespace App\Notifications;

use App\Models\EmailNotificationSetting;
use App\Support\EntityActivityMailBuilder;
use Illuminate\Notifications\Messages\MailMessage;

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

    public function toMail($notifiable): MailMessage
    {
        $build = parent::build($notifiable);
        $url = getDomainSpecificUrl(route('tasks.show', $this->task->id), $this->company);
        $taskShortCode = $this->task->task_short_code ? '#'.$this->task->task_short_code : '';
        $subject = trim(__('email.taskUpdate.subject').' '.$taskShortCode);
        $introText = $this->capitalizeSentences(__('email.taskUpdate.intro'));
        $detailHtml = EntityActivityMailBuilder::renderDetailBlock(
            $this->safeMailText($this->task->heading, 200),
            $this->taskMetaLine(),
        );
        $actionText = __('email.taskUpdate.action');

        $build
            ->subject($subject.' - '.config('app.name'))
            ->view('mail.task.updated', [
                'url' => $url,
                'content' => '',
                'detailHtml' => $detailHtml,
                'preheader' => $this->safePreheader($introText),
                'subject' => $subject,
                'introText' => $introText,
                'actionText' => $actionText,
                'notifiableName' => $notifiable->name,
            ]);

        $this->attachEntityActivityPlunk($build, [
            'mailSubject' => $subject,
            'preheader' => $introText,
            'badgeLabel' => 'Task Update',
            'notifiableName' => $notifiable->name,
            'introText' => $introText,
            'detailHtml' => $detailHtml,
            'contentHtml' => '',
            'actionDescription' => __('email.taskUpdate.footer'),
            'actionText' => $actionText,
            'entityUrl' => $url,
        ]);

        parent::resetLocale();

        return $build;
    }

    protected function mailContent($notifiable): string
    {
        return $this->task->heading;
    }

    public function toArray($notifiable): array
    {
        $this->eventType = $this->eventType();

        return [
            'id' => $this->task->id,
            'task_id' => $this->task->id,
            'heading' => $this->task->heading,
            'title' => __('email.taskUpdate.subject'),
            'text' => $this->capitalizeSentences(__('email.taskUpdate.intro')),
            'event_type' => $this->eventType,
            'action_url' => getDomainSpecificUrl(route('tasks.show', $this->task->id), $this->company),
        ];
    }

    protected function taskMetaLine(): string
    {
        if (! $this->task->project) {
            return '';
        }

        return $this->safeMailText($this->task->project->project_name, 200);
    }
}
