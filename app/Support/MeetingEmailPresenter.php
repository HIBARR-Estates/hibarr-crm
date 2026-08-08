<?php

namespace App\Support;

use App\Models\Company;
use App\Models\DealFollowUp;
use Carbon\CarbonInterface;
use Carbon\CarbonInterval;
use Illuminate\Support\Carbon;

/**
 * Builds meeting email copy and template variables for leads vs internal users.
 */
class MeetingEmailPresenter
{
    public function __construct(
        private readonly DealFollowUp $followUp,
        private readonly ?Company $company = null,
        private readonly ?string $remarkOverride = null,
    ) {
        $this->followUp->loadMissing([
            'meetingType',
            'addedBy',
            'deal.contact',
            'deal.leadAgent.user',
            'lead',
        ]);
    }

    public function meetingAt(): ?CarbonInterface
    {
        if (!$this->followUp->next_follow_up_date) {
            return null;
        }

        $timezone = $this->company?->timezone ?? config('app.timezone');

        return $this->followUp->next_follow_up_date->copy()->timezone($timezone);
    }

    public function meetingDate(): string
    {
        $at = $this->meetingAt();
        if (!$at) {
            return '';
        }

        return $at->format($this->company?->date_format ?? config('app.date_format', 'Y-m-d'));
    }

    public function meetingTime(): string
    {
        $at = $this->meetingAt();
        if (!$at) {
            return '';
        }

        return $at->format($this->company?->time_format ?? config('app.time_format', 'H:i'));
    }

    public function leadName(): string
    {
        return trim((string) (
            $this->followUp->deal?->client_name
            ?? $this->followUp->lead?->client_name
            ?? ''
        ));
    }

    public function dealName(): string
    {
        return trim((string) ($this->followUp->deal?->name ?? ''));
    }

    public function minutesUntilMeeting(): ?int
    {
        $meetingAt = $this->meetingAt();
        if ($meetingAt === null) {
            return null;
        }

        $secondsUntil = $meetingAt->getTimestamp() - now()->getTimestamp();
        if ($secondsUntil <= 0) {
            return 0;
        }

        return max(1, (int) ceil($secondsUntil / 60));
    }

    public function agentName(): string
    {
        return trim((string) (
            $this->followUp->addedBy?->name
            ?? $this->followUp->deal?->leadAgent?->user?->name
            ?? $this->company?->name
            ?? config('app.name')
        ));
    }

    public function meetingTypeName(): string
    {
        return trim((string) ($this->followUp->meetingType?->name ?? ''));
    }

    public function meetingRemark(): string
    {
        $remark = $this->remarkOverride ?? $this->followUp->remark ?? '';

        return trim((string) $remark);
    }

    public function meetingLink(): string
    {
        $link = trim((string) ($this->followUp->meeting_link ?? ''));
        if ($link === '' || ! filter_var($link, FILTER_VALIDATE_URL)) {
            return '';
        }

        $scheme = strtolower((string) (parse_url($link, PHP_URL_SCHEME) ?? ''));

        return in_array($scheme, ['http', 'https'], true) ? $link : '';
    }

    public function joinMeetingHtml(): string
    {
        $link = $this->meetingLink();
        if ($link === '') {
            return '';
        }

        $label = e(__('email.meetingCreated.joinMeeting'));

        return '<p style="margin:20px 0 0;font-family:\'DM Mono\',Consolas,monospace;font-size:12px;line-height:1.7">'
            .'<a href="'.e($link).'" style="color:#003160;text-decoration:underline">'.$label.' &rarr;</a>'
            .'</p>';
    }

    public function entityUrl(): string
    {
        if ($this->followUp->deal_id) {
            return getDomainSpecificUrl(
                route('deals.show', $this->followUp->deal_id).'?tab=meetings',
                $this->company
            );
        }

        if ($this->followUp->lead_id) {
            return getDomainSpecificUrl(
                route('lead-contact.show', $this->followUp->lead_id).'?tab=meetings',
                $this->company
            );
        }

        return '';
    }

    public function actionText(bool $isLeadRecipient): string
    {
        if ($isLeadRecipient) {
            return '';
        }

        if ($this->followUp->deal_id) {
            return __('email.meetingCreated.viewDeal');
        }

        if ($this->followUp->lead_id) {
            return __('email.meetingCreated.viewLead');
        }

        return __('email.meetingReminder.action');
    }

    public function counterpartName(bool $isLeadRecipient): string
    {
        return $isLeadRecipient ? $this->agentName() : $this->leadName();
    }

    public function badgeLabel(bool $isCreatedNotice): string
    {
        return $isCreatedNotice
            ? __('email.meetingCreated.badge')
            : __('email.meetingReminder.badge');
    }

    public function footerNote(bool $isLeadRecipient, bool $isCreatedNotice): string
    {
        if ($isCreatedNotice) {
            return $isLeadRecipient
                ? __('email.meetingCreated.leadFooterNote')
                : __('email.meetingCreated.agentFooterNote');
        }

        return $isLeadRecipient
            ? __('email.meetingReminder.leadFooterNote')
            : __('email.meetingReminder.footerNote');
    }

    public function scheduleLine(): string
    {
        $date = $this->meetingDate();
        $time = $this->meetingTime();

        if ($date !== '' && $time !== '') {
            return $date.' &ensp;&middot;&ensp; '.$time;
        }

        return $date !== '' ? $date : $time;
    }

    public function crmButtonHtml(bool $isLeadRecipient): string
    {
        if ($isLeadRecipient) {
            return '';
        }

        $url = $this->entityUrl();
        $text = $this->actionText(false);

        return self::buildCrmButtonHtml($url, $text);
    }

    public static function buildCrmButtonHtml(string $url, string $text): string
    {
        if ($url === '' || $text === '') {
            return '';
        }

        return '<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0 24px">'
            .'<tr><td bgcolor="#003160">'
            .'<a href="'.e($url).'" style="display:inline-block;background-color:#003160;color:#ffffff;font-family:\'DM Mono\',Consolas,monospace;font-size:12px;font-weight:700;letter-spacing:0.10em;text-decoration:none;padding:13px 28px;text-transform:uppercase">'
            .e($text).' &rarr;</a>'
            .'</td></tr></table>';
    }

    /**
     * Build the date/agenda block for meeting emails.
     *
     * $scheduleLine is inserted into HTML without escaping so callers may include
     * trusted entities such as &ensp; and &middot;. Do not pass raw user input.
     * $detailRemark is escaped via e() + nl2br.
     */
    public static function buildMeetingDetailHtml(string $scheduleLine, string $detailRemark, string $agendaLabel = ''): string
    {
        $parts = [];

        if ($scheduleLine !== '') {
            $parts[] = '<div style="font-family:Syne,Georgia,serif;font-size:20px;font-weight:700;color:#0a0e1a;line-height:1.2;margin-bottom:8px">'
                .$scheduleLine
                .'</div>';
        }

        if ($detailRemark !== '') {
            $label = $agendaLabel !== '' ? $agendaLabel : __('email.meetingCreated.agenda');
            $parts[] = '<div style="margin-top:14px">'
                .'<div style="font-family:\'DM Mono\',Consolas,monospace;font-size:11px;line-height:16px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#4a5272;margin-bottom:6px">'
                .e($label)
                .'</div>'
                .'<div style="font-family:Syne,Georgia,serif;font-size:14px;line-height:22px;color:#0a0e1a">'
                .nl2br(e($detailRemark))
                .'</div>'
                .'</div>';
        }

        if ($parts === []) {
            return '';
        }

        return '<div style="border-top:1px solid #d5dce8;margin:20px 0 0;padding:20px 0 0">'
            .implode('', $parts)
            .'</div>';
    }

    public function subject(bool $isLeadRecipient, bool $isCreatedNotice): string
    {
        if ($isCreatedNotice) {
            return $this->createdSubject($isLeadRecipient);
        }

        return $this->reminderSubject($isLeadRecipient);
    }

    public function message(bool $isLeadRecipient, bool $isCreatedNotice): string
    {
        if ($isCreatedNotice) {
            return $this->createdMessage($isLeadRecipient);
        }

        return $this->reminderMessage($isLeadRecipient);
    }

    /**
     * @return array<string, mixed>
     */
    public function templateVariables($notifiable, bool $isLeadRecipient, bool $isCreatedNotice): array
    {
        $meetingAt = $this->meetingAt();
        $meetingMessage = $this->message($isLeadRecipient, $isCreatedNotice);
        $url = $isLeadRecipient ? '' : $this->entityUrl();
        $actionText = $this->actionText($isLeadRecipient);
        $detailRemark = $meetingAt !== null ? $this->meetingRemark() : '';
        $scheduleLine = $this->scheduleLine();
        $mailSubject = $this->subject($isLeadRecipient, $isCreatedNotice);

        return [
            'url' => $url,
            'preheader' => $meetingMessage,
            'mailSubject' => $mailSubject,
            'appName' => (string) config('app.name'),
            'badgeLabel' => $this->badgeLabel($isCreatedNotice),
            'meetingMessage' => $meetingMessage,
            'scheduleLine' => $scheduleLine,
            'meetingDetailHtml' => self::buildMeetingDetailHtml($scheduleLine, $detailRemark),
            'meetingDate' => $this->meetingDate(),
            'meetingTime' => $this->meetingTime(),
            'meetingRemark' => $detailRemark,
            'meetingLink' => $this->meetingLink(),
            'joinMeetingHtml' => $this->joinMeetingHtml(),
            'crmButtonHtml' => $this->crmButtonHtml($isLeadRecipient),
            'actionText' => $actionText,
            'footerNote' => $this->footerNote($isLeadRecipient, $isCreatedNotice),
            'notifiableName' => $notifiable->name ?? $this->counterpartName($isLeadRecipient),
        ];
    }

    /**
     * Variables sent to Plunk — keep in sync with deal-follow-up-reminder.plunk.html.
     *
     * @param  array<string, mixed>  $variables
     * @return array<string, mixed>
     */
    public static function plunkVariables(array $variables): array
    {
        return [
            'preheader' => $variables['preheader'] ?? $variables['meetingMessage'],
            'mailSubject' => $variables['mailSubject'],
            'appName' => $variables['appName'],
            'badgeLabel' => $variables['badgeLabel'],
            'meetingMessage' => $variables['meetingMessage'],
            'meetingDetailHtml' => $variables['meetingDetailHtml'],
            'joinMeetingHtml' => $variables['joinMeetingHtml'],
            'crmButtonHtml' => $variables['crmButtonHtml'],
            'footerNote' => $variables['footerNote'],
        ];
    }

    private function createdSubject(bool $isLeadRecipient): string
    {
        $date = $this->meetingDate();
        $time = $this->meetingTime();
        $schedule = $this->formatScheduleFragment($date, $time);

        if ($isLeadRecipient) {
            $agent = $this->agentName();

            if ($agent !== '' && $schedule !== '') {
                return __('email.meetingCreated.leadSubject', [
                    'agent' => $agent,
                    'schedule' => $schedule,
                ]);
            }

            if ($agent !== '') {
                return __('email.meetingCreated.leadSubjectNoSchedule', ['agent' => $agent]);
            }

            return __('email.meetingCreated.leadSubjectFallback');
        }

        $lead = $this->leadName();

        if ($lead !== '' && $schedule !== '') {
            return __('email.meetingCreated.agentSubject', [
                'lead' => $lead,
                'schedule' => $schedule,
            ]);
        }

        if ($lead !== '') {
            return __('email.meetingCreated.agentSubjectNoSchedule', ['lead' => $lead]);
        }

        return __('email.meetingCreated.agentSubjectFallback');
    }

    private function createdMessage(bool $isLeadRecipient): string
    {
        $date = $this->meetingDate();
        $time = $this->meetingTime();
        $type = $this->meetingTypeName();

        if ($isLeadRecipient) {
            $agent = $this->agentName();

            if ($type !== '' && $agent !== '' && $date !== '' && $time !== '') {
                return __('email.meetingCreated.leadMessageWithType', [
                    'type' => $type,
                    'agent' => $agent,
                    'date' => $date,
                    'time' => $time,
                ]);
            }

            if ($agent !== '' && $date !== '' && $time !== '') {
                return __('email.meetingCreated.leadMessage', [
                    'agent' => $agent,
                    'date' => $date,
                    'time' => $time,
                ]);
            }

            return __('email.meetingCreated.leadMessageFallback');
        }

        $lead = $this->leadName();

        if ($type !== '' && $lead !== '' && $date !== '' && $time !== '') {
            return __('email.meetingCreated.agentMessageWithType', [
                'type' => $type,
                'lead' => $lead,
                'date' => $date,
                'time' => $time,
            ]);
        }

        if ($lead !== '' && $date !== '' && $time !== '') {
            return __('email.meetingCreated.agentMessage', [
                'lead' => $lead,
                'date' => $date,
                'time' => $time,
            ]);
        }

        return __('email.meetingCreated.agentMessageFallback');
    }

    private function reminderSubject(bool $isLeadRecipient): string
    {
        $meetingAt = $this->meetingAt();
        $lead = $this->leadName();
        $agent = $this->agentName();

        if ($meetingAt === null) {
            return $isLeadRecipient
                ? ($agent !== ''
                    ? __('email.meetingReminder.leadSubjectNoScheduleWithAgent', ['agent' => $agent])
                    : __('email.meetingReminder.leadSubjectNoSchedule'))
                : ($lead !== ''
                    ? __('email.meetingReminder.subjectNoScheduleWithLead', ['lead' => $lead])
                    : __('email.meetingReminder.subjectNoSchedule'));
        }

        $secondsUntil = $meetingAt->getTimestamp() - now()->getTimestamp();

        if ($secondsUntil <= 0) {
            if ($isLeadRecipient) {
                return $agent !== ''
                    ? __('email.meetingReminder.leadSubjectStartingNow', ['agent' => $agent])
                    : __('email.meetingReminder.leadSubjectStartingNowNoAgent');
            }

            return $lead !== ''
                ? __('email.meetingReminder.subjectStartingNow', ['lead' => $lead])
                : __('email.meetingReminder.subjectStartingNowNoLead');
        }

        $countdownText = $this->countdownUntil($meetingAt);
        if ($countdownText === '') {
            $countdownText = 'less than a minute';
        }

        $isSoon = $secondsUntil <= 900;

        if ($isLeadRecipient) {
            return $agent !== ''
                ? __('email.meetingReminder.leadSubjectUpcoming', [
                    'agent' => $agent,
                    'countdown' => $countdownText,
                ])
                : __('email.meetingReminder.leadSubjectUpcomingNoAgent', [
                    'countdown' => $countdownText,
                ]);
        }

        if ($isSoon) {
            return $lead !== ''
                ? __('email.meetingReminder.subjectSoon', [
                    'lead' => $lead,
                    'countdown' => $countdownText,
                ])
                : __('email.meetingReminder.subjectSoonNoLead', [
                    'countdown' => $countdownText,
                ]);
        }

        return $lead !== ''
            ? __('email.meetingReminder.subjectUpcoming', [
                'lead' => $lead,
                'countdown' => $countdownText,
            ])
            : __('email.meetingReminder.subjectUpcomingNoLead', [
                'countdown' => $countdownText,
            ]);
    }

    private function reminderMessage(bool $isLeadRecipient): string
    {
        $meetingAt = $this->meetingAt();
        $countdown = $meetingAt ? $this->countdownUntil($meetingAt) : '';
        $remark = $this->meetingRemark();

        if ($meetingAt === null) {
            return $remark !== ''
                ? $remark
                : ($isLeadRecipient
                    ? __('email.meetingReminder.leadNoDate')
                    : __('email.followUpReminder.followUpLeadText'));
        }

        $secondsUntil = $meetingAt->getTimestamp() - now()->getTimestamp();

        if ($isLeadRecipient) {
            return $this->leadReminderMessage($secondsUntil, $countdown);
        }

        return $this->agentReminderMessage($secondsUntil, $countdown);
    }

    private function leadReminderMessage(int $secondsUntil, string $countdown): string
    {
        $agent = $this->agentName();
        $schedule = $this->scheduleLine();
        $minutesLabel = $this->minutesLabel();

        if ($secondsUntil <= 0) {
            return $agent !== ''
                ? __('email.meetingReminder.leadStartingNow', ['agent' => $agent])
                : __('email.meetingReminder.leadStartingNowNoAgent');
        }

        $countdownText = $countdown !== '' ? $countdown : $minutesLabel;

        if ($agent !== '' && $schedule !== '') {
            return __('email.meetingReminder.leadCountdownWithSchedule', [
                'agent' => $agent,
                'countdown' => $countdownText,
                'minutesLabel' => $minutesLabel,
                'schedule' => $schedule,
            ]);
        }

        return $agent !== ''
            ? __('email.meetingReminder.leadCountdown', [
                'agent' => $agent,
                'countdown' => $countdownText,
                'minutesLabel' => $minutesLabel,
            ])
            : __('email.meetingReminder.leadCountdownNoAgent', [
                'countdown' => $countdownText,
                'minutesLabel' => $minutesLabel,
            ]);
    }

    private function agentReminderMessage(int $secondsUntil, string $countdown): string
    {
        $lead = $this->leadName();
        $type = $this->meetingTypeName();
        $schedule = $this->scheduleLine();
        $deal = $this->dealName();
        $minutesLabel = $this->minutesLabel();

        if ($secondsUntil <= 0) {
            if ($type !== '' && $lead !== '') {
                return __('email.meetingReminder.agentStartingNowWithType', [
                    'type' => $type,
                    'lead' => $lead,
                ]);
            }

            return $lead !== ''
                ? __('email.meetingReminder.agentStartingNow', ['lead' => $lead])
                : __('email.meetingReminder.agentStartingNowNoLead');
        }

        $params = [
            'lead' => $lead,
            'type' => $type,
            'deal' => $deal,
            'schedule' => $schedule,
            'countdown' => $countdown !== '' ? $countdown : $minutesLabel,
            'minutesLabel' => $minutesLabel,
        ];

        if ($lead === '') {
            return $schedule !== ''
                ? __('email.meetingReminder.agentCountdownNoLeadWithSchedule', $params)
                : __('email.meetingReminder.agentCountdownNoLead', $params);
        }

        if ($deal !== '' && $schedule !== '') {
            return __('email.meetingReminder.agentCountdownWithDeal', $params);
        }

        if ($type !== '' && $schedule !== '') {
            return __('email.meetingReminder.agentCountdownWithType', $params);
        }

        if ($schedule !== '') {
            return __('email.meetingReminder.agentCountdown', $params);
        }

        return __('email.meetingReminder.agentCountdownNoSchedule', $params);
    }

    private function minutesLabel(): string
    {
        $minutes = $this->minutesUntilMeeting() ?? 1;

        return trans_choice('email.meetingReminder.minutes', $minutes, ['count' => $minutes]);
    }

    private function formatScheduleFragment(string $date, string $time): string
    {
        if ($date !== '' && $time !== '') {
            return __('email.meetingCreated.scheduleAt', ['date' => $date, 'time' => $time]);
        }

        if ($date !== '') {
            return $date;
        }

        return $time;
    }

    private function countdownUntil(CarbonInterface $at): string
    {
        $secondsUntil = $at->getTimestamp() - now()->getTimestamp();

        if ($secondsUntil <= 0) {
            return '';
        }

        $totalMinutes = max(1, (int) ceil($secondsUntil / 60));

        return CarbonInterval::minutes($totalMinutes)
            ->cascade()
            ->forHumans(['parts' => 2, 'short' => false, 'join' => ' ']);
    }
}
