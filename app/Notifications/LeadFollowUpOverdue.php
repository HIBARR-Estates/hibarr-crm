<?php

namespace App\Notifications;

use App\Models\DealFollowUp;
use App\Models\EmailNotificationSetting;
use App\Support\MeetingEmailPresenter;
use Carbon\CarbonInterface;

class LeadFollowUpOverdue extends BaseNotification
{
    private DealFollowUp $followUp;

    private ?EmailNotificationSetting $emailSetting;

    private string $entityName;

    public function __construct(DealFollowUp $followUp)
    {
        $this->followUp = $followUp;
        $this->company = $followUp->deal?->company ?? $followUp->lead?->company;
        $this->entityName = $this->resolveEntityName();
        $this->emailSetting = $this->company
            ? EmailNotificationSetting::where('company_id', $this->company->id)
                ->where('slug', 'follow-up-reminder')
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
            && $notifiable->email !== ''
        ) {
            $via[] = 'mail';
        }

        return $via;
    }

    public function toMail($notifiable)
    {
        $build = parent::build($notifiable);
        $presenter = new MeetingEmailPresenter($this->followUp, $this->company);
        $scheduledAt = $this->followUp->next_follow_up_date;

        $build
            ->subject(__('email.leadFollowUpOverdue.subject').' - '.config('app.name'))
            ->view('mail.lead.lead-follow-up-overdue', [
                'url' => $this->actionUrl(),
                'entityName' => $this->entityName,
                'scheduledDate' => $scheduledAt
                    ? $presenter->meetingDate()
                    : '',
                'scheduledTime' => $scheduledAt
                    ? $presenter->meetingTime()
                    : '',
                'overdueMessage' => $this->bodyText(),
                'preheader' => $this->bodyText(),
                'actionText' => $this->followUp->deal_id
                    ? __('email.followUpReminder.viewDeal')
                    : __('email.followUpReminder.viewLead'),
                'notifiableName' => $notifiable->name,
            ]);

        parent::resetLocale();

        return $build;
    }

    public function toArray($notifiable): array
    {
        return [
            'entity_type' => 'meeting',
            'follow_up_id' => $this->followUp->id,
            'deal_id' => $this->followUp->deal_id,
            'lead_id' => $this->followUp->lead_id,
            'id' => $this->followUp->deal_id ?? $this->followUp->lead_id ?? $this->followUp->id,
            'name' => $this->entityName,
            'title' => __('email.leadFollowUpOverdue.subject'),
            'text' => $this->bodyText(),
            'action_url' => $this->actionUrl(),
            'overdue_since' => $this->followUp->next_follow_up_date?->format('Y-m-d H:i:s'),
        ];
    }

    private function resolveEntityName(): string
    {
        if ($this->followUp->deal) {
            return trim((string) ($this->followUp->deal->name ?? ''))
                ?: trim((string) ($this->followUp->deal->contact?->client_name ?? ''))
                ?: __('modules.deal.deal');
        }

        return trim((string) ($this->followUp->lead?->client_name ?? ''))
            ?: __('modules.lead.lead');
    }

    private function bodyText(): string
    {
        $scheduledAt = $this->followUp->next_follow_up_date;
        $schedule = $scheduledAt instanceof CarbonInterface
            ? $scheduledAt->copy()->timezone($this->company?->timezone ?: 'UTC')->format(
                ($this->company?->date_format ?? 'Y-m-d').' H:i'
            )
            : '';

        return __('email.leadFollowUpOverdue.text', [
            'entityName' => $this->entityName,
            'schedule' => $schedule,
        ]);
    }

    private function actionUrl(): string
    {
        if ($this->followUp->deal_id) {
            $url = route('deals.show', $this->followUp->deal_id).'?tab=meetings';

            return $this->company ? getDomainSpecificUrl($url, $this->company) : $url;
        }

        if ($this->followUp->lead_id) {
            $url = route('lead-contact.show', $this->followUp->lead_id).'?tab=meetings';

            return $this->company ? getDomainSpecificUrl($url, $this->company) : $url;
        }

        return url('/');
    }
}
