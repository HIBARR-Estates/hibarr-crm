<?php

namespace App\Notifications;

use App\Models\EmailNotificationSetting;
use App\Models\Task;
use Illuminate\Notifications\Messages\MailMessage;

abstract class TaskLifecycleBaseNotification extends BaseNotification
{
    protected Task $task;

    protected string $eventType;

    protected ?EmailNotificationSetting $emailSetting;

    public function __construct(Task $task)
    {
        $this->task = $task;
        $this->company = $task->company;
        $this->emailSetting = $this->resolveEmailSetting();
        $this->initTaskMailRouting();
    }

    abstract protected function resolveEmailSetting(): ?EmailNotificationSetting;

    abstract protected function eventType(): string;

    abstract protected function mailSubject(): string;

    abstract protected function mailView(): string;

    /**
     * @param mixed $notifiable
     * @return array<int, string>
     */
    public function via($notifiable): array
    {
        return $this->resolveChannels($this->emailSetting, $notifiable);
    }

    public function toMail($notifiable): MailMessage
    {
        $this->eventType = $this->eventType();

        $build = parent::build($notifiable);
        $url = route('tasks.show', $this->task->id);
        $url = getDomainSpecificUrl($url, $this->company);

        $taskShortCode = $this->task->task_short_code ? '#' . $this->task->task_short_code . ' ' : '';

        $build
            ->subject($this->mailSubject() . ' ' . $taskShortCode . config('app.name') . '.')
            ->view($this->mailView(), [
                'url' => $url,
                'content' => $this->mailContent($notifiable),
                'themeColor' => $this->company->header_color,
                'actionText' => __('email.taskUpdate.action'),
                'notifiableName' => $notifiable->name,
            ]);

        parent::resetLocale();

        return $build;
    }

    /**
     * @param mixed $notifiable
     */
    protected function mailContent($notifiable): string
    {
        return $this->task->heading;
    }

    /**
     * @param mixed $notifiable
     * @return array<string, mixed>
     */
    public function toArray($notifiable): array
    {
        $this->eventType = $this->eventType();

        return [
            'id' => $this->task->id,
            'task_id' => $this->task->id,
            'heading' => $this->task->heading,
            'event_type' => $this->eventType,
            'action_url' => getDomainSpecificUrl(route('tasks.show', $this->task->id), $this->company),
        ];
    }
}
