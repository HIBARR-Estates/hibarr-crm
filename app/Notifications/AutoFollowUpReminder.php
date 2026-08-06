<?php

namespace App\Notifications;

use App\Models\DealFollowUp;
use App\Models\EmailNotificationSetting;
use App\Models\Lead;
use App\Support\MeetingIcsBuilder;

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

        if (
            $this->emailSetting
            && $this->emailSetting->send_email == 'yes'
            && $notifiable->email_notifications
            && $notifiable->email != ''
        ) {
            $via[] = 'mail';
        }

        $mailSubject = ($this->subject)
            ? __('email.followUpReminder.newFollowUpSubject')
            : __('email.followUpReminder.subject');
        $pushBody = $this->subject
            ? $this->resolveCreatedHeadline($this->displayName())
            : $this->displayName();

        if (
            $this->emailSetting
            && $this->emailSetting->send_push == 'yes'
            && push_setting()->beams_push_status == 'active'
        ) {
            $pushNotification = new \App\Http\Controllers\DashboardController();
            $pushUsersIds = [[$notifiable->id]];
            $pushNotification->sendPushNotifications($pushUsersIds, $mailSubject, $pushBody);
        }

        return $via;
    }

    public function toMail($notifiable)
    {
        $build = parent::build($notifiable);
        $url = $this->entityUrl();
        $url = getDomainSpecificUrl($url, $this->company);

        $followUpLead = $this->displayName();
        $followUpDate = $this->leadFollowup?->next_follow_up_date?->format($this->company->date_format);
        $followUpTime = $this->leadFollowup?->next_follow_up_date?->format($this->company->time_format);

        $headline = $this->subject
            ? $this->resolveCreatedHeadline($followUpLead)
            : __('email.followUpReminder.followUpLeadText');

        // The headline already names the lead when this is the "just created" notice;
        // avoid repeating it on its own line right below.
        $leadLine = ($this->subject && $followUpLead !== '')
            ? ''
            : __('email.followUpReminder.followUpLead') . ' :- ' . $followUpLead . '<br>';

        $content = $headline . '<br><br>'
            . $leadLine
            . __('email.followUpReminder.nextFollowUpDate') . ' :- ' . $followUpDate . '<br>'
            . __('email.followUpReminder.nextFollowUpTime') . ' :- ' . $followUpTime . '<br>'
            . $this->leadFollowup->remark;

        $mailSubject = ($this->subject)
            ? __('email.followUpReminder.newFollowUpSubject')
            : __('email.followUpReminder.subject');

        $entityId = $this->leadFollowup->deal_id
            ?? $this->leadFollowup->lead_id
            ?? $this->leadFollowup->id;

        $build
            ->subject($mailSubject . ' #' . $entityId . ' - ' . config('app.name') . '.')
            ->markdown('mail.email', [
                'url' => $url,
                'content' => $content,
                'themeColor' => $this->company?->header_color,
                'actionText' => __('email.followUpReminder.action'),
                'notifiableName' => $notifiable->name,
            ]);

        $contact = $this->leadFollowup->deal?->contact
            ?? $this->leadFollowup->lead;

        $this->attachPlunkTemplate($build, '24330e3e-a357-41d2-8762-7014732d5b7e', [
            'leadName' => $followUpLead,
            'leadEmail' => $contact instanceof Lead
                ? ($contact->client_email ?? '')
                : (optional($contact)->client_email ?? ''),
            'meetingDate' => $followUpDate,
            'meetingTime' => $followUpTime,
            'meetingRemark' => $this->leadFollowup->remark ?? '',
            'leadUrl' => $url,
        ]);

        $this->attachMeetingIcs($build);

        parent::resetLocale();

        return $build;
    }

    /**
     * Attach a calendar invite so the recipient can add the meeting to their
     * calendar. Only on the "just created" notice ($subject === true) — the
     * recipient already has it in their calendar by the time a periodic
     * reminder fires, so resending the same invite would just prompt them
     * to needlessly re-accept an event they've already got.
     */
    private function attachMeetingIcs($build): void
    {
        if (! $this->subject) {
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
        return [
            'follow_up_id' => $this->leadFollowup->id,
            'id' => $this->leadFollowup->deal_id
                ?? $this->leadFollowup->lead_id
                ?? $this->leadFollowup->id,
            'created_at' => $this->leadFollowup->created_at?->format('Y-m-d H:i:s'),
            'heading' => __('email.followUpReminder.subject'),
        ];
    }

    public function toSlack($notifiable)
    {
        $followUpLead = $this->displayName();
        $followUpDate = $this->leadFollowup?->next_follow_up_date?->format($this->company->date_format);
        $followUpTime = $this->leadFollowup?->next_follow_up_date?->format($this->company->time_format);

        $headline = $this->subject
            ? $this->resolveCreatedHeadline($followUpLead)
            : __('email.followUpReminder.followUpLeadText');

        $leadLine = ($this->subject && $followUpLead !== '')
            ? ''
            : __('email.followUpReminder.followUpLead') . ' :- ' . $followUpLead . '<br>';

        return $this->slackBuild($notifiable)
            ->content(
                $headline . '<br><br>'
                . $leadLine
                . __('email.followUpReminder.nextFollowUpDate') . ' :- ' . $followUpDate . '<br>'
                . __('email.followUpReminder.nextFollowUpTime') . ' :- ' . $followUpTime . '<br>'
                . $this->leadFollowup->remark
            );
    }

    private function displayName(): string
    {
        return $this->leadFollowup->deal?->client_name
            ?? $this->leadFollowup->lead?->client_name
            ?? '';
    }

    /**
     * "New meeting created" headline — names both the meeting type and the
     * client, e.g. "New Discovery Call meeting with Ada Lovelace created."
     */
    private function resolveCreatedHeadline(string $leadName): string
    {
        $meetingTypeName = $this->leadFollowup->meetingType?->name;

        if ($meetingTypeName && $leadName !== '') {
            return __('email.followUpReminder.newMeetingCreatedWithType', [
                'type' => $meetingTypeName,
                'lead' => $leadName,
            ]);
        }

        if ($leadName !== '') {
            return __('email.followUpReminder.newMeetingCreated', ['lead' => $leadName]);
        }

        if ($meetingTypeName) {
            return __('email.followUpReminder.newMeetingCreatedTypeOnly', ['type' => $meetingTypeName]);
        }

        return __('email.followUpReminder.newFollowUpSubject');
    }

    private function entityUrl(): string
    {
        if ($this->leadFollowup->deal_id) {
            return route('deals.show', $this->leadFollowup->deal_id) . '?tab=follow-up';
        }

        if ($this->leadFollowup->lead_id) {
            return route('lead-contact.show', $this->leadFollowup->lead_id) . '?tab=meetings';
        }

        return url('/');
    }
}
