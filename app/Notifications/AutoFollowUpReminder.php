<?php

namespace App\Notifications;

use App\Models\DealFollowUp;
use App\Models\EmailNotificationSetting;
use App\Models\Lead;
use App\Models\ReminderEmailTemplate;
use App\Support\LeadLocaleResolver;
use App\Support\MeetingEmailPresenter;
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
        $email = is_string($notifiable->email ?? null) ? $notifiable->email : ($notifiable->client_email ?? '');

        if (
            $this->emailSetting
            && $this->emailSetting->send_email == 'yes'
            && ($notifiable->email_notifications ?? true)
            && $email != ''
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
        $templateId = ReminderEmailTemplate::plunkTemplateId($companyId, 'meeting');

        if ($templateId === null) {
            $templateId = '24330e3e-a357-41d2-8762-7014732d5b7e';
        }

        $this->attachPlunkTemplate($build, $templateId, MeetingEmailPresenter::plunkVariables($variables));
    }

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
        $presenter = $this->presenter();
        $isLeadRecipient = $notifiable instanceof Lead;

        return [
            'follow_up_id' => $this->leadFollowup->id,
            'id' => $this->leadFollowup->deal_id
                ?? $this->leadFollowup->lead_id
                ?? $this->leadFollowup->id,
            'created_at' => $this->leadFollowup->created_at?->format('Y-m-d H:i:s'),
            'heading' => $presenter->subject($isLeadRecipient, (bool) $this->subject),
        ];
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
