<?php

namespace App\Notifications;

use App\Models\EmailNotificationSetting;
use App\Models\Task;
use App\Notifications\Channels\BeamsPushChannel;
use App\Support\EntityActivityMailBuilder;
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
        $this->emailSetting = $this->company
            ? EmailNotificationSetting::where('company_id', $this->company->id)
                ->where('slug', $emailSettingSlug)
                ->first()
            : null;
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
            && filled($notifiable->email)
        ) {
            $via[] = 'mail';
        }

        if (
            $this->emailSetting
            && $this->emailSetting->send_slack === 'yes'
            && $this->company?->slackSetting?->status === 'active'
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
            $via[] = BeamsPushChannel::class;
        }

        return $via;
    }

    /**
     * @param  mixed  $notifiable
     * @return array{title: string, body: string}|null
     */
    public function toBeamsPush($notifiable): ?array
    {
        if (! $this->emailSetting || $this->emailSetting->send_push !== 'yes') {
            return null;
        }

        return [
            'title' => $this->pushTitle(),
            'body' => (string) $this->task->heading,
        ];
    }

    abstract protected function pushTitle(): string;

    abstract protected function mailSubject(): string;

    abstract protected function mailContent($notifiable): string;

    abstract protected function actionText(): string;

    public function toMail($notifiable): MailMessage
    {
        $build = parent::build($notifiable);
        $url = $this->taskUrl();
        $subject = rtrim($this->mailSubject(), '.');
        $introText = $this->safeMailText($this->mailIntro($notifiable), 500);
        $detailHtml = $this->mailDetailHtml($notifiable);
        $content = $this->mailSupplementalContent($notifiable);
        $actionText = $this->actionText();

        $build
            ->subject($this->mailSubject())
            ->view('mail.task.activity', [
                'url' => $url,
                'content' => $content,
                'detailHtml' => $detailHtml,
                'preheader' => $this->safePreheader($introText),
                'subject' => $subject,
                'badgeLabel' => 'Task Update',
                'actionText' => $actionText,
                'introText' => $introText,
                'notifiableName' => $notifiable->name,
            ]);

        $this->attachEntityActivityPlunk($build, [
            'mailSubject' => $subject,
            'preheader' => $introText,
            'badgeLabel' => 'Task Update',
            'notifiableName' => $notifiable->name,
            'introText' => $introText,
            'detailHtml' => $detailHtml,
            'contentHtml' => $content,
            'actionDescription' => __('Click the button below to view the task details.'),
            'actionText' => $actionText,
            'entityUrl' => $url,
        ]);

        parent::resetLocale();

        return $build;
    }

    /**
     * @param  mixed  $notifiable
     */
    protected function mailIntro($notifiable): string
    {
        return strip_tags(str_replace('<br>', ' ', $this->mailContent($notifiable)));
    }

    /**
     * @param  mixed  $notifiable
     */
    protected function mailDetailHtml($notifiable): string
    {
        return EntityActivityMailBuilder::renderDetailBlock(
            $this->safeMailText($this->task->heading, 200),
            $this->taskMetaLine(),
        );
    }

    /**
     * @param  mixed  $notifiable
     */
    protected function mailSupplementalContent($notifiable): string
    {
        return '';
    }

    protected function taskMetaLine(): string
    {
        if (! $this->task->project) {
            return '';
        }

        return $this->safeMailText($this->task->project->project_name, 200);
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
            'text' => $this->mailIntro($notifiable),
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

        return __('app.project').' - '.$this->safeMailText($this->task->project->project_name, 200).'<br>';
    }
}
