<?php

namespace App\Notifications;

use App\Models\EmailNotificationSetting;
use App\Models\ExposeJob;

class ExposeReadyNotification extends BaseNotification
{
    private ExposeJob $exposeJob;

    private ?EmailNotificationSetting $emailSetting;

    public function __construct(ExposeJob $exposeJob)
    {
        $this->exposeJob = $exposeJob;
        $this->company = $exposeJob->company;
        $this->emailSetting = $this->company
            ? EmailNotificationSetting::where('company_id', $this->company->id)
                ->where('slug', 'expose-ready')
                ->first()
            : null;

        $this->initUnsRouting();
    }

    public function via($notifiable): array
    {
        $via = ['database'];

        if (
            $this->emailSetting
            && $this->emailSetting->send_email === 'yes'
            && $notifiable->email_notifications
            && ! empty($notifiable->email)
        ) {
            $via[] = 'mail';
        }

        return $via;
    }

    public function toMail($notifiable)
    {
        $build = parent::build($notifiable);
        $subject = 'Your exposé is ready';
        $url = $this->exposeJob->download_url;
        $filename = $this->exposeJob->filename ?? 'expose.pdf';
        $introText = 'Your PDF exposé has finished generating and is ready to download.';
        $contentHtml = '<strong>File:</strong> '.$this->safeMailText($filename, 200);

        if ($url && $this->company) {
            $url = getDomainSpecificUrl($url, $this->company);
        }

        $build
            ->subject($subject.' - '.config('app.name'))
            ->view('mail.property.activity', [
                'url' => $url,
                'content' => $contentHtml,
                'preheader' => $this->safePreheader($subject),
                'subject' => $subject,
                'actionText' => __('app.download'),
                'introText' => $introText,
                'notifiableName' => $notifiable->name,
            ]);

        $this->attachExposeReadyPlunk($build, [
            'mailSubject' => $subject,
            'preheader' => $introText,
            'badgeLabel' => 'Exposé Ready',
            'notifiableName' => $notifiable->name,
            'introText' => $introText,
            'contentHtml' => $contentHtml,
            'actionDescription' => __('Click the button below to download your exposé.'),
            'actionText' => __('app.download'),
            'downloadUrl' => $url ?? '',
        ]);

        parent::resetLocale();

        return $build;
    }

    public function toArray($notifiable): array
    {
        $propertyId = $this->exposeJob->entity_type === ExposeJob::ENTITY_PROPERTY
            ? $this->exposeJob->entity_id
            : null;

        return [
            'id' => $propertyId ?? $this->exposeJob->id,
            'property_id' => $propertyId,
            'expose_job_id' => $this->exposeJob->id,
            'type' => 'expose_ready',
            'filename' => $this->exposeJob->filename,
            'download_url' => $this->exposeJob->download_url,
            'entity_type' => $this->exposeJob->entity_type,
            'entity_id' => $this->exposeJob->entity_id,
            'heading' => 'Exposé ready',
            'text' => 'Your PDF exposé '.($this->exposeJob->filename ?? '').' is ready to download',
            'activity_icon' => 'file',
        ];
    }
}
