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
            config('app.automations.followups.overdue_email_enabled', false)
            && $notifiable->status === 'active'
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
        $presenter = new MeetingEmailPresenter($this->followUp, $this->company);
        $scheduledAt = $this->followUp->next_follow_up_date;
        $mailSubject = __('email.leadFollowUpOverdue.subject');
        $bodyText = $this->bodyText();
        $actionUrl = $this->actionUrl();
        $actionText = $this->followUp->deal_id
            ? __('email.followUpReminder.viewDeal')
            : __('email.followUpReminder.viewLead');
        $scheduledDate = $scheduledAt ? $presenter->meetingDate() : '';
        $scheduledTime = $scheduledAt ? $presenter->meetingTime() : '';

        $build
            ->subject($mailSubject.' - '.config('app.name'))
            ->view('mail.lead.lead-follow-up-overdue', [
                'url' => $actionUrl,
                'entityName' => $this->entityName,
                'scheduledDate' => $scheduledDate,
                'scheduledTime' => $scheduledTime,
                'overdueMessage' => $bodyText,
                'preheader' => $bodyText,
                'actionText' => $actionText,
                'notifiableName' => $notifiable->name,
            ]);

        $templateId = config('email.plunk_template_ids.lead_follow_up_overdue');
        if (is_string($templateId) && $templateId !== '') {
            $this->attachPlunkTemplate($build, $templateId, [
                'mailSubject' => $mailSubject,
                'appName' => config('app.name'),
                'preheader' => $bodyText,
                'badgeLabel' => $mailSubject,
                'notifiableName' => $notifiable->name,
                'overdueMessage' => $bodyText,
                'scheduledDate' => $scheduledDate,
                'scheduledTime' => $scheduledTime,
                'entityName' => $this->entityName,
                'actionDescription' => __('email.leadFollowUpOverdue.footerNote'),
                'actionText' => $actionText,
                'actionUrl' => $actionUrl,
                'currentYear' => date('Y'),
            ]);
        }

        parent::resetLocale();

        return $build;
    }

    public function toArray($notifiable): array
    {
        return [
            'id' => $this->followUp->lead_id ?? $this->followUp->deal_id ?? $this->followUp->id,
            'entity_type' => 'meeting',
            'follow_up_id' => $this->followUp->id,
            'deal_id' => $this->followUp->deal_id,
            'lead_id' => $this->followUp->lead_id,
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
