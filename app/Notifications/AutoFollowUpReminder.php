<?php

namespace App\Notifications;

use App\Models\DealFollowUp;
use App\Models\EmailNotificationSetting;
use App\Models\Lead;
use App\Models\ReminderEmailTemplate;
use App\Support\LeadLocaleResolver;
use App\Support\MeetingEmailPresenter;
use App\Support\MeetingIcsBuilder;
use App\Support\SafeHttpUrl;

class AutoFollowUpReminder extends BaseNotification
{
    private $leadFollowup;
    private $subject;
    private $emailSetting;

    public function __construct(DealFollowUp $leadFollowup, $subject)
    {
        $this->leadFollowup = $leadFollowup;
        $this->subject = $subject;

        $company = $leadFollowup->deal?->company
            ?? $leadFollowup->lead?->company
            ?? company();

        $this->company = $company;

        if ($company) {
            $this->emailSetting = EmailNotificationSetting::where('company_id', $company->id)
                ->where('slug', 'follow-up-reminder')
                ->first();
        }

        $this->initUnsRouting();
    }

    public function via($notifiable)
    {
        $via = ['database'];
        // Leads route mail via client_email (Lead::routeNotificationForMail); users via email.
        if ($notifiable instanceof Lead) {
            $email = is_string($notifiable->client_email ?? null) ? trim($notifiable->client_email) : '';
        } else {
            $email = is_string($notifiable->email ?? null) ? trim($notifiable->email) : '';
        }

        if (
            $this->emailSetting
            && $this->emailSetting->send_email == 'yes'
            && ($notifiable->email_notifications ?? true)
            && $email !== ''
        ) {
            $via[] = 'mail';
        }

        if (
            $notifiable instanceof \App\Models\User
            && $this->emailSetting
            && $this->emailSetting->send_push == 'yes'
            && push_setting()->beams_push_status == 'active'
        ) {
            $presenter = $this->presenter();
            $isCreated = (bool) $this->subject;
            $mailSubject = $presenter->subject(false, $isCreated);
            $pushBody = $presenter->message(false, $isCreated);

            $pushNotification = new \App\Http\Controllers\DashboardController();
            $pushUsersIds = [[$notifiable->id]];
            $pushNotification->sendPushNotifications($pushUsersIds, $mailSubject, $pushBody);
        }

        return $via;
    }

    public function toMail($notifiable)
    {
        $isLeadRecipient = $notifiable instanceof Lead;
        if ($isLeadRecipient) {
            LeadLocaleResolver::apply($notifiable, $this->company);
        }

        $build = parent::build($notifiable);
        $isCreatedNotice = (bool) $this->subject;
        $presenter = $this->presenter();
        $variables = $presenter->templateVariables($notifiable, $isLeadRecipient, $isCreatedNotice);

        $build
            ->subject($variables['mailSubject'].' - '.$variables['appName'])
            ->view('mail.deal-follow-up.deal-follow-up-reminder', $variables);

        $this->attachMeetingPlunkTemplate($build, $variables);
        $this->attachMeetingIcs($build);

        parent::resetLocale();

        return $build;
    }

    /**
     * @param  array<string, mixed>  $variables
     */
    private function attachMeetingPlunkTemplate($build, array $variables): void
    {
        $companyId = $this->company?->id ? (int) $this->company->id : 0;
        $templateId = ReminderEmailTemplate::plunkTemplateId($companyId, 'meeting')
            ?? config('reminders.plunk_fallback_template_ids.meeting');

        if (! is_string($templateId) || $templateId === '') {
            return;
        }

        $this->attachPlunkTemplate($build, $templateId, MeetingEmailPresenter::plunkVariables($variables));
    }

    private function attachMeetingIcs($build): void
    {
        if (! $this->subject) {
            return;
        }

        // Plunk/UNS cannot send attachments. Attaching .ics would force SMTP
        // fallback (often misconfigured locally). Calendar sync already creates
        // the invite on connected calendars (Zoho, etc.).
        if ($this->unsRoutingEnabled) {
            return;
        }

        $ics = MeetingIcsBuilder::build($this->leadFollowup);
        if ($ics === null) {
            return;
        }

        $build->attachData($ics['content'], $ics['filename'], [
            'mime' => 'text/calendar; method=REQUEST; charset=UTF-8',
        ]);
    }

    // phpcs:ignore
    public function toArray($notifiable)
    {
        $presenter = $this->presenter();
        $isLeadRecipient = $notifiable instanceof Lead;
        $isCreatedNotice = (bool) $this->subject;
        $followUp = $this->leadFollowup;
        $meetingAt = $presenter->meetingAt();
        $startsNow = $meetingAt !== null
            && $meetingAt->getTimestamp() - now()->getTimestamp() <= 0;

        $payload = [
            'entity_type' => 'meeting',
            'follow_up_id' => $followUp->id,
            'deal_id' => $followUp->deal_id,
            'lead_id' => $followUp->lead_id,
            'id' => $followUp->deal_id ?? $followUp->lead_id ?? $followUp->id,
            'created_at' => $followUp->created_at?->format('Y-m-d H:i:s'),
            'heading' => $presenter->subject($isLeadRecipient, $isCreatedNotice),
            'title' => $presenter->subject($isLeadRecipient, $isCreatedNotice),
            'text' => $presenter->message($isLeadRecipient, $isCreatedNotice),
            'action_url' => $this->resolveFollowUpActionUrl(),
            'starts_now' => $startsNow,
        ];

        if (\App\Support\MeetingLocation::supportsJoinLink($followUp->location ?? null)) {
            $meetingLink = SafeHttpUrl::validate($followUp->meeting_link);
            if ($meetingLink !== null) {
                $payload['meeting_link'] = $meetingLink;
            }
        }

        return $payload;
    }

    private function resolveFollowUpActionUrl(): string
    {
        $followUp = $this->leadFollowup;

        if ($followUp->deal_id) {
            $url = route('deals.show', $followUp->deal_id).'?tab=meetings';

            return $this->company ? getDomainSpecificUrl($url, $this->company) : $url;
        }

        if ($followUp->lead_id) {
            $url = route('lead-contact.show', $followUp->lead_id).'?tab=meetings';

            return $this->company ? getDomainSpecificUrl($url, $this->company) : $url;
        }

        return url('/');
    }

    public function toSlack($notifiable)
    {
        $isLeadRecipient = $notifiable instanceof Lead;
        $presenter = $this->presenter();
        $isCreatedNotice = (bool) $this->subject;

        return $this->slackBuild($notifiable)
            ->content(
                $presenter->message($isLeadRecipient, $isCreatedNotice).'<br><br>'
                .$presenter->meetingDate().' '.$presenter->meetingTime().'<br>'
                .$presenter->meetingRemark()
            );
    }

    private function presenter(): MeetingEmailPresenter
    {
        return new MeetingEmailPresenter($this->leadFollowup, $this->company);
    }
}
