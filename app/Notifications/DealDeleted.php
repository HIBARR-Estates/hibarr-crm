<?php

namespace App\Notifications;

use App\Models\Deal;
use App\Models\EmailNotificationSetting;
use App\Models\User;

class DealDeleted extends BaseNotification
{
    private int $dealId;

    private string $dealName;

    private ?int $deletedById;

    private string $deletedByName;

    private ?EmailNotificationSetting $emailSetting;

    public function __construct(Deal $deal, ?User $deletedBy = null)
    {
        $this->company = $deal->company;
        $this->dealId = (int) $deal->id;
        $this->dealName = trim((string) ($deal->name ?? '')) ?: __('modules.deal.deal');
        $this->deletedById = $deletedBy?->id;
        $this->deletedByName = trim((string) ($deletedBy?->name ?? '')) ?: __('email.dealDeleted.unknownActor');
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

        if ($this->suppressBulkTransactionalEmails) {
            return $via;
        }

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
        $url = getDomainSpecificUrl(route('deals.index'), $this->company);

        $mailSubject = __('email.dealDeleted.subject');
        $bodyText = $this->bodyText();
        $actionText = __('email.dealDeleted.action');

        $build
            ->subject($mailSubject.' - '.config('app.name'))
            ->view('mail.deal.deal-deleted', [
                'url' => $url,
                'dealName' => $this->dealName,
                'deletedByName' => $this->deletedByName,
                'preheader' => $bodyText,
                'actionText' => $actionText,
                'notifiableName' => $notifiable->name,
            ]);

        $this->attachDealDeletedPlunk($build, [
            'mailSubject' => $mailSubject,
            'appName' => config('app.name'),
            'preheader' => $bodyText,
            'badgeLabel' => $mailSubject,
            'notifiableName' => $notifiable->name,
            'bodyText' => $bodyText,
            'dealName' => $this->dealName,
            'deletedByName' => $this->deletedByName,
            'actionDescription' => __('email.dealDeleted.actionDescription'),
            'actionText' => $actionText,
            'dealUrl' => $url,
            'currentYear' => date('Y'),
        ]);

        parent::resetLocale();

        return $build;
    }

    public function toArray($notifiable): array
    {
        return [
            'id' => $this->dealId,
            'deal_id' => $this->dealId,
            'deal_name' => $this->dealName,
            'name' => $this->dealName,
            'deleted_by' => $this->deletedById,
            'deleted_by_name' => $this->deletedByName,
            'title' => __('email.dealDeleted.subject'),
            'text' => $this->bodyText(),
            'action_url' => getDomainSpecificUrl(route('deals.index'), $this->company),
        ];
    }

    private function bodyText(): string
    {
        return __('email.dealDeleted.text', [
            'dealName' => $this->dealName,
            'deletedBy' => $this->deletedByName,
        ]);
    }
}
