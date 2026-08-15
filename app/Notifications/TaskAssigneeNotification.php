<?php

namespace App\Notifications;

use App\Models\EmailNotificationSetting;
use App\Models\Task;
use Illuminate\Notifications\Messages\MailMessage;
use NotificationChannels\OneSignal\OneSignalChannel;

abstract class TaskAssigneeNotification extends BaseNotification
{
    protected Task $task;

    protected ?EmailNotificationSetting $emailSetting;

    public function __construct(Task $task, string $emailSettingSlug)
    {
        $this->task = $task;
        $this->company = $task->company;
        $this->emailSetting = EmailNotificationSetting::where('company_id', $this->company->id)
            ->where('slug', $emailSettingSlug)
            ->first();
        $this->initUnsRouting();
    }

    /**
     * @param  mixed  $notifiable
     * @return array<int, string>
     */
    public function via($notifiable): array
    {
        $via = ['database'];

        if ($this->suppressBulkTransactionalEmails) {
            return $via;
        }

        if (
            $this->emailSetting
            && $this->emailSetting->send_email === 'yes'
            && $notifiable->email_notifications
            && $notifiable->email !== ''
        ) {
            $via[] = 'mail';
        }

        if (
            $this->emailSetting
            && $this->emailSetting->send_slack === 'yes'
            && $this->company->slackSetting?->status === 'active'
            && $this->slackUserNameCheck($notifiable)
        ) {
            $via[] = 'slack';
        }

        if ($this->emailSetting && $this->emailSetting->send_push === 'yes' && push_setting()->status === 'active') {
            $via[] = OneSignalChannel::class;
        }

        if (
            $this->emailSetting
            && $this->emailSetting->send_push === 'yes'
            && push_setting()->beams_push_status === 'active'
            && isset($notifiable->id)
        ) {
            $pushNotification = new \App\Http\Controllers\DashboardController;
            $pushNotification->sendPushNotifications(
                [[$notifiable->id]],
                $this->pushTitle(),
                $this->task->heading
            );
        }

        return $via;
    }

    abstract protected function pushTitle(): string;

    abstract protected function mailSubject(): string;

    abstract protected function mailContent($notifiable): string;

    abstract protected function actionText(): string;

    public function toMail($notifiable): MailMessage
    {
        $build = parent::build($notifiable);
        $url = $this->taskUrl();
        $content = $this->mailContent($notifiable);
        $subject = rtrim($this->mailSubject(), '.');
        $introText = $this->safeMailText(strip_tags(str_replace('<br>', ' ', $content)), 500);

        $build
            ->subject($this->mailSubject())
            ->markdown('mail.email', [
                'url' => $url,
                'content' => $content,
                'themeColor' => $this->company->header_color,
                'actionText' => $this->actionText(),
                'notifiableName' => $notifiable->name,
            ]);

        $this->attachEntityActivityPlunk($build, [
            'mailSubject' => $subject,
            'preheader' => $introText,
            'badgeLabel' => 'Task Update',
            'notifiableName' => $notifiable->name,
            'introText' => $introText,
            'contentHtml' => $content,
            'actionDescription' => __('Click the button below to view the task details.'),
            'actionText' => $this->actionText(),
            'entityUrl' => $url,
        ]);

        parent::resetLocale();

        return $build;
    }

    /**
     * @param  mixed  $notifiable
     * @return array<string, mixed>
     */
    public function toArray($notifiable): array
    {
        return [
            'id' => $this->task->id,
            'task_id' => $this->task->id,
            'heading' => $this->task->heading,
            'title' => $this->pushTitle(),
            'created_at' => now()->format('Y-m-d H:i:s'),
        ];
    }

    protected function taskUrl(): string
    {
        return getDomainSpecificUrl(route('tasks.show', $this->task->id), $this->company);
    }

    protected function taskShortCode(): string
    {
        return $this->task->task_short_code ? '#'.$this->task->task_short_code.' ' : ' ';
    }

    protected function projectLine(): string
    {
        if (! $this->task->project) {
            return '';
        }

        return __('app.project').' - '.$this->task->project->project_name.'<br>';
    }
}
