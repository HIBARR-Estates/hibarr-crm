<?php

namespace App\Notifications;

use App\Models\EmailNotificationSetting;
use App\Models\Lead;
use App\Models\User;

class LeadDeleted extends BaseNotification
{
    private int $leadId;

    private string $leadName;

    private ?int $deletedById;

    private string $deletedByName;

    private ?EmailNotificationSetting $emailSetting;

    public function __construct(Lead $lead, ?User $deletedBy = null)
    {
        $this->company = $lead->company;
        $this->leadId = (int) $lead->id;
        $this->leadName = trim((string) ($lead->client_name ?? '')) ?: __('modules.lead.lead');
        $this->deletedById = $deletedBy?->id;
        $this->deletedByName = trim((string) ($deletedBy?->name ?? '')) ?: __('email.leadDeleted.unknownActor');
        $this->emailSetting = $this->company
            ? EmailNotificationSetting::where('company_id', $this->company->id)
                ->where('slug', 'lead-notification')
                ->first()
            : null;

        $this->initUnsRouting();
    }

    public function via($notifiable): array
    {
        $via = ['database'];

        if (
            $notifiable->status === 'active'
            && $this->emailSetting
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
        $url = getDomainSpecificUrl(route('lead-contact.index'), $this->company);

        $mailSubject = __('email.leadDeleted.subject');
        $bodyText = $this->bodyText();
        $actionText = __('email.leadDeleted.action');

        $build
            ->subject($mailSubject.' - '.config('app.name'))
            ->view('mail.lead.lead-deleted', [
                'url' => $url,
                'leadName' => $this->leadName,
                'deletedByName' => $this->deletedByName,
                'preheader' => $bodyText,
                'actionText' => $actionText,
                'notifiableName' => $notifiable->name,
            ]);

        $this->attachPlunkTemplate($build, '727f5903-5332-4ec3-992d-ad289264a10a', [
            'mailSubject' => $mailSubject,
            'appName' => config('app.name'),
            'preheader' => $bodyText,
            'badgeLabel' => $mailSubject,
            'notifiableName' => $notifiable->name,
            'bodyText' => $bodyText,
            'leadName' => $this->leadName,
            'deletedByName' => $this->deletedByName,
            'actionDescription' => __('email.leadDeleted.actionDescription'),
            'actionText' => $actionText,
            'leadUrl' => $url,
            'currentYear' => date('Y'),
        ]);

        parent::resetLocale();

        return $build;
    }

    public function toArray($notifiable): array
    {
        return [
            'id' => $this->leadId,
            'lead_id' => $this->leadId,
            'name' => $this->leadName,
            'deleted_by' => $this->deletedById,
            'deleted_by_name' => $this->deletedByName,
            'title' => __('email.leadDeleted.subject'),
            'text' => $this->bodyText(),
            'action_url' => getDomainSpecificUrl(route('lead-contact.index'), $this->company),
        ];
    }

    private function bodyText(): string
    {
        return __('email.leadDeleted.text', [
            'leadName' => $this->leadName,
            'deletedBy' => $this->deletedByName,
        ]);
    }
}
