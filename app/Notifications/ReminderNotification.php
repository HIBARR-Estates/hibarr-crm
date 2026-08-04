<?php

namespace App\Notifications;

use App\Models\DealFollowUp;
use App\Models\EmailNotificationSetting;
use App\Models\Reminder;
use Illuminate\Notifications\Messages\MailMessage;

class ReminderNotification extends BaseNotification
{
    // Same Plunk template the legacy AutoFollowUpReminder notification used, so
    // follow-up reminder emails keep their branded design after the migration
    // to the generic Reminder model.
    private const FOLLOW_UP_PLUNK_TEMPLATE_ID = '24330e3e-a357-41d2-8762-7014732d5b7e';

    private Reminder $reminder;

    private ?EmailNotificationSetting $emailSetting;

    private string $anonymousName = 'there';

    private bool $mailOnly = false;

    private ?DealFollowUp $followUp = null;

    private bool $followUpLoaded = false;

    public function __construct(Reminder $reminder)
    {
        $this->reminder = $reminder;
        $this->company = $reminder->company()->first();
        $this->emailSetting = $this->company
            ? EmailNotificationSetting::where('company_id', $this->company->id)
                ->where('slug', 'follow-up-reminder')
                ->first()
            : null;
        $this->initUnsRouting();
        // Prefer inline delivery when queued; ReminderSender uses sendNow/notifyNow.
        $this->onConnection('sync');
    }

    public function forAnonymousMail(string $name): self
    {
        $this->anonymousName = $name;
        $this->mailOnly = true;

        return $this;
    }

    public function via($notifiable): array
    {
        if ($this->mailOnly) {
            return $this->shouldSendMail($notifiable) ? ['mail'] : [];
        }

        $via = ['database'];

        if ($this->shouldSendMail($notifiable)) {
            $via[] = 'mail';
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
                __('email.followUpReminder.subject'),
                $this->reminder->message ?? ''
            );
        }

        return $via;
    }

    public function toMail($notifiable): MailMessage
    {
        $build = parent::build($notifiable);
        $url = $this->resolveUrl();
        $name = $notifiable->name ?? $this->anonymousName;

        $followUp = $this->resolveFollowUp();
        $deal = $followUp?->deal;
        $dateFormat = $this->company->date_format ?? config('app.date_format', 'Y-m-d');
        $timeFormat = $this->company->time_format ?? config('app.time_format', 'H:i');
        $remindAtLocal = $this->reminder->remind_at && $this->company
            ? $this->reminder->remind_at->timezone($this->company->timezone ?? config('app.timezone'))
            : null;

        $leadName = $deal?->client_name ?? '';
        $leadEmail = optional($deal?->contact)->client_email ?? '';
        $meetingDate = $remindAtLocal?->format($dateFormat) ?? '';
        $meetingTime = $remindAtLocal?->format($timeFormat) ?? '';
        $meetingRemark = $this->reminder->message ?? $followUp?->remark ?? '';

        $content = $meetingRemark !== '' ? $meetingRemark : __('email.followUpReminder.followUpLeadText');
        if ($leadName !== '') {
            $content .= '<br><br>'.__('email.followUpReminder.followUpLead').' :- '.$leadName;
        }
        if ($meetingDate !== '') {
            $content .= '<br>'.__('email.followUpReminder.nextFollowUpDate').' :- '.$meetingDate;
        }
        if ($meetingTime !== '') {
            $content .= '<br>'.__('email.followUpReminder.nextFollowUpTime').' :- '.$meetingTime;
        }

        $build
            ->subject(__('email.followUpReminder.subject').' - '.config('app.name'))
            ->markdown('mail.email', [
                'url' => $url,
                'content' => $content,
                'themeColor' => $this->company?->header_color,
                'actionText' => __('email.followUpReminder.action'),
                'notifiableName' => $name,
            ]);

        if ($this->reminder->entity_type === Reminder::ENTITY_MEETING) {
            $this->attachPlunkTemplate($build, self::FOLLOW_UP_PLUNK_TEMPLATE_ID, [
                'leadName' => $leadName,
                'leadEmail' => $leadEmail,
                'meetingDate' => $meetingDate,
                'meetingTime' => $meetingTime,
                'meetingRemark' => $meetingRemark,
                'leadUrl' => $url,
            ]);
        }

        parent::resetLocale();

        return $build;
    }

    public function toArray($notifiable): array
    {
        return [
            'reminder_id' => $this->reminder->id,
            'entity_type' => $this->reminder->entity_type,
            'entity_id' => $this->reminder->entity_id,
            'remind_at' => optional($this->reminder->remind_at)->toIso8601String(),
            'heading' => __('email.followUpReminder.subject'),
        ];
    }

    private function shouldSendMail($notifiable): bool
    {
        if (! $this->emailSetting || $this->emailSetting->send_email !== 'yes') {
            return false;
        }

        if ($this->mailOnly) {
            return true;
        }

        return (bool) ($notifiable->email_notifications ?? true)
            && ! empty($notifiable->email);
    }

    private function resolveUrl(): string
    {
        $followUp = $this->resolveFollowUp();

        if ($followUp?->deal_id) {
            $url = route('deals.show', $followUp->deal_id).'?tab=follow-up';

            return $this->company ? getDomainSpecificUrl($url, $this->company) : $url;
        }
        if ($followUp?->lead_id) {
            $url = url("/account/leads/{$followUp->lead_id}");

            return $this->company ? getDomainSpecificUrl($url, $this->company) : $url;
        }

        return url('/');
    }

    private function resolveFollowUp(): ?DealFollowUp
    {
        if ($this->followUpLoaded) {
            return $this->followUp;
        }

        $this->followUpLoaded = true;

        if ($this->reminder->entity_type === Reminder::ENTITY_MEETING && $this->reminder->entity_id) {
            $this->followUp = DealFollowUp::with('deal.contact')->find($this->reminder->entity_id);
        }

        return $this->followUp;
    }
}
