<?php

namespace App\Notifications;

use App\Models\Deal;
use App\Models\EmailNotificationSetting;
use Carbon\CarbonInterface;

class DealCloseDateApproaching extends BaseNotification
{
    private Deal $deal;

    private ?EmailNotificationSetting $emailSetting;

    public function __construct(Deal $deal)
    {
        $this->deal = $deal;
        $this->company = $deal->company;
        $this->emailSetting = $this->company
            ? EmailNotificationSetting::where('company_id', $this->company->id)
                ->where('slug', 'deal-activity-notification')
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
        $closeDate = $this->formattedCloseDate();

        $mailSubject = __('email.dealCloseDateApproaching.subject');
        $bodyText = $this->bodyText();
        $dealName = $this->dealName();
        $dealUrl = $this->actionUrl();
        $actionText = __('email.dealCloseDateApproaching.action');

        $build
            ->subject($mailSubject.' - '.config('app.name'))
            ->view('mail.deal.deal-close-date-approaching', [
                'url' => $dealUrl,
                'dealName' => $dealName,
                'closeDate' => $closeDate,
                'preheader' => $bodyText,
                'actionText' => $actionText,
                'notifiableName' => $notifiable->name,
            ]);

        $this->attachPlunkTemplate($build, 'f1da65e3-4b42-40c5-b5ae-1ba82fe3d94d', [
            'mailSubject' => $mailSubject,
            'appName' => config('app.name'),
            'preheader' => $bodyText,
            'badgeLabel' => $mailSubject,
            'notifiableName' => $notifiable->name,
            'bodyText' => $bodyText,
            'closeDate' => $closeDate,
            'dealName' => $dealName,
            'actionDescription' => __('Review the deal and update the close date if plans have changed.'),
            'actionText' => $actionText,
            'dealUrl' => $dealUrl,
        ]);

        parent::resetLocale();

        return $build;
    }

    public function toArray($notifiable): array
    {
        return [
            'id' => $this->deal->id,
            'deal_id' => $this->deal->id,
            'deal_name' => $this->dealName(),
            'name' => $this->dealName(),
            'close_date' => $this->deal->close_date?->format('Y-m-d'),
            'title' => __('email.dealCloseDateApproaching.subject'),
            'text' => $this->bodyText(),
            'action_url' => $this->actionUrl(),
        ];
    }

    private function dealName(): string
    {
        return trim((string) ($this->deal->name ?? ''))
            ?: trim((string) ($this->deal->contact?->client_name ?? ''))
            ?: __('modules.deal.deal');
    }

    private function formattedCloseDate(): string
    {
        $closeDate = $this->deal->close_date;

        if (! $closeDate instanceof CarbonInterface) {
            return '';
        }

        $format = $this->company?->date_format ?? 'Y-m-d';

        return $closeDate->copy()->timezone($this->company?->timezone ?: 'UTC')->format($format);
    }

    private function bodyText(): string
    {
        return __('email.dealCloseDateApproaching.text', [
            'dealName' => $this->dealName(),
            'closeDate' => $this->formattedCloseDate(),
        ]);
    }

    private function actionUrl(): string
    {
        $url = route('deals.show', $this->deal->id);

        return $this->company ? getDomainSpecificUrl($url, $this->company) : $url;
    }
}
