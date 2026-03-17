<?php

namespace App\Notifications;

use App\Models\EmailNotificationSetting;
use App\Models\Lead;

class LeadOwnerAssigned extends BaseNotification
{
    private Lead $lead;
    private ?int $previousOwnerId;
    private ?EmailNotificationSetting $emailSetting;

    public function __construct(Lead $lead, ?int $previousOwnerId = null)
    {
        $this->lead = $lead;
        $this->company = $this->lead->company;
        $this->previousOwnerId = $previousOwnerId;
        $this->emailSetting = $this->company
            ? EmailNotificationSetting::where('company_id', $this->company->id)
                ->where('slug', 'lead-notification')
                ->first()
            : null;
    }

    public function via($notifiable)
    {
        $via = ['database'];

        if (
            $this->emailSetting &&
            $this->emailSetting->send_email === 'yes' &&
            $notifiable->email_notifications &&
            $notifiable->email !== ''
        ) {
            $via[] = 'mail';
        }

        return $via;
    }

    public function toMail($notifiable)
    {
        $build = parent::build($notifiable);
        $url = route('lead-contact.show', $this->lead->id);
        $url = getDomainSpecificUrl($url, $this->company);

        $contentParts = [
            'A lead has been assigned to you.',
            __('modules.lead.clientName') . ': ' . ($this->lead->client_name_salutation ?? $this->lead->client_name),
        ];

        if (!empty($this->lead->client_email)) {
            $contentParts[] = __('modules.lead.clientEmail') . ': ' . $this->lead->client_email;
        }

        $build
            ->subject('Lead owner assigned - ' . config('app.name'))
            ->view('mail.lead-assigned', [
                'url' => $url,
                'content' => implode('<br>', $contentParts),
                'themeColor' => $this->company?->header_color,
                'actionText' => 'View Lead',
                'notifiableName' => $notifiable->name,
            ]);

        parent::resetLocale();

        return $build;
    }

    public function toArray($notifiable)
    {
        return [
            'id' => $this->lead->id,
            'name' => $this->lead->client_name,
            'previous_owner_id' => $this->previousOwnerId,
            'new_owner_id' => $notifiable->id,
            'added_by' => $this->lead->added_by,
        ];
    }
}

