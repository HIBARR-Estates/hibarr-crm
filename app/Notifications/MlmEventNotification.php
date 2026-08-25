<?php

namespace App\Notifications;

use App\Enums\MlmNotificationEvent;
use App\Models\Company;
use App\Models\EmailNotificationSetting;
use Illuminate\Notifications\Messages\MailMessage;

class MlmEventNotification extends BaseNotification
{
    private MlmNotificationEvent $event;

    /** @var array<string, mixed> */
    private array $context;

    private ?EmailNotificationSetting $emailSetting = null;

    /**
     * @param  array<string, mixed>  $context
     */
    public function __construct(
        MlmNotificationEvent $event,
        int $companyId,
        array $context = [],
        ?int $triggeredByUserId = null,
    ) {
        $this->event = $event;
        $this->context = $context;
        $this->company = Company::query()->find($companyId);
        $this->captureTriggeredByUser($triggeredByUserId);
        $this->initUnsRouting();

        if ($this->company) {
            $this->emailSetting = EmailNotificationSetting::query()
                ->where('company_id', $this->company->id)
                ->where('slug', $event->emailSettingSlug())
                ->first();
        }
    }

    protected function unsIdempotencyPrefix(): ?string
    {
        $parts = ['crm-mlm', $this->event->value];

        if (! empty($this->context['commission_id'])) {
            $parts[] = (string) $this->context['commission_id'];
        }

        return implode('-', $parts);
    }

    public function via($notifiable): array
    {
        if ($this->isTriggeredByNotifiable($notifiable)) {
            return [];
        }

        $via = ['database'];

        if ($this->suppressBulkTransactionalEmails) {
            return $via;
        }

        if ($this->emailSetting
            && $this->emailSetting->send_email === 'yes'
            && $notifiable->email_notifications
            && ! empty($notifiable->email)
        ) {
            $via[] = 'mail';
        }

        return $via;
    }

    public function toMail($notifiable): MailMessage
    {
        $build = parent::build($notifiable);
        $subject = $this->translate('subject');
        $introText = $this->translate('intro');
        $footerNote = $this->translate('footer');
        $actionText = $this->translate('action');
        $url = $this->actionUrl();
        $detailHtml = $this->detailHtml();
        $content = $detailHtml !== '' ? '' : $this->translate('body');

        $build
            ->subject($subject.' - '.config('app.name'))
            ->view('mail.mlm.event', [
                'url' => $url,
                'content' => $content,
                'detailHtml' => $detailHtml,
                'preheader' => $this->safePreheader($introText),
                'subject' => $subject,
                'actionText' => $actionText,
                'introText' => $introText,
                'footerNote' => $footerNote,
                'notifiableName' => $notifiable->name,
                'badgeLabel' => __('email.mlm.badge'),
            ]);

        $this->attachEntityActivityPlunk($build, [
            'mailSubject' => $subject,
            'preheader' => $this->safePreheader($introText),
            'badgeLabel' => __('email.mlm.badge'),
            'notifiableName' => $notifiable->name,
            'introText' => $introText,
            'detailHtml' => $detailHtml ?: '',
            'contentHtml' => $content !== '' ? '<div class="callout">'.$content.'</div>' : '',
            'actionDescription' => $footerNote,
            'actionText' => $actionText,
            'entityUrl' => $url,
        ]);

        parent::resetLocale();

        return $build;
    }

    public function toArray($notifiable): array
    {
        $intro = $this->translate('intro');

        return [
            'type' => $this->event->value,
            'icon' => $this->event->icon(),
            'heading' => $this->translate('subject'),
            'description' => $intro,
            'text' => $intro,
            'context' => $this->context,
            'action_url' => $this->actionUrl(),
        ];
    }

    private function translate(string $key): string
    {
        $langKey = $this->event->langKey().'.'.$key;
        $replacements = $this->translationReplacements();

        $line = __($langKey, $replacements);

        return $line === $langKey ? '' : (string) $line;
    }

    /**
     * @return array<string, string|int|null>
     */
    private function translationReplacements(): array
    {
        return array_merge([
            'appName' => config('app.name'),
        ], collect($this->context)->mapWithKeys(function ($value, $key) {
            return [$key => is_scalar($value) || $value === null ? $value : ''];
        })->all());
    }

    private function actionUrl(): string
    {
        if (! $this->company) {
            return url('/');
        }

        $dealId = $this->context['deal_id'] ?? null;
        $leadId = $this->context['lead_id'] ?? null;

        $path = match ($this->event) {
            MlmNotificationEvent::CommissionEarned,
            MlmNotificationEvent::CommissionPaid,
            MlmNotificationEvent::CommissionClawback,
            MlmNotificationEvent::CommissionDisputed => route('mlm.agent.commissions'),
            MlmNotificationEvent::AgentLevelUpgraded,
            MlmNotificationEvent::AgentLevelDowngraded,
            MlmNotificationEvent::AgentLevelCriteriaApproaching,
            MlmNotificationEvent::CycleCriteriaMet,
            MlmNotificationEvent::CycleDeadlineApproaching => route('mlm.agent.my_level'),
            MlmNotificationEvent::AgentCommissionProfileChanged => route('mlm.agent.my_level'),
            MlmNotificationEvent::CycleStarted,
            MlmNotificationEvent::CycleCompleted => route('mlm.agent.dashboard'),
            MlmNotificationEvent::ReferralCodeUsed => $leadId
                ? route('lead-contact.show', $leadId)
                : route('mlm.agent.dashboard'),
            MlmNotificationEvent::ReferralConvertedToDeal => $dealId
                ? route('deals.show', $dealId)
                : route('mlm.agent.deal_contributions'),
            MlmNotificationEvent::NewRecruitAdded => route('mlm.agent.network'),
            MlmNotificationEvent::PartnerNetworkJoined => route('mlm.agent.dashboard'),
        };

        return getDomainSpecificUrl($path, $this->company);
    }

    private function detailHtml(): string
    {
        $rows = [];

        if (! empty($this->context['amount'])) {
            $rows[] = [
                'label' => __('email.mlm.detail.amount'),
                'value' => (string) $this->context['amount'],
            ];
        }

        if (! empty($this->context['currency_code'])) {
            $rows[] = [
                'label' => __('email.mlm.detail.currency'),
                'value' => (string) $this->context['currency_code'],
            ];
        }

        if (! empty($this->context['percentage'])) {
            $rows[] = [
                'label' => __('email.mlm.detail.percentage'),
                'value' => $this->context['percentage'].'%',
            ];
        }

        if (! empty($this->context['deal_name'])) {
            $rows[] = [
                'label' => __('modules.deal.dealName'),
                'value' => (string) $this->context['deal_name'],
            ];
        }

        if (! empty($this->context['level_name'])) {
            $rows[] = [
                'label' => __('email.mlm.detail.level'),
                'value' => (string) $this->context['level_name'],
            ];
        }

        if (! empty($this->context['cycle_name'])) {
            $rows[] = [
                'label' => __('email.mlm.detail.cycle'),
                'value' => (string) $this->context['cycle_name'],
            ];
        }

        if (! empty($this->context['lead_name'])) {
            $rows[] = [
                'label' => __('modules.lead.clientName'),
                'value' => (string) $this->context['lead_name'],
            ];
        }

        if (! empty($this->context['recruit_name'])) {
            $rows[] = [
                'label' => __('email.mlm.detail.recruit'),
                'value' => (string) $this->context['recruit_name'],
            ];
        }

        if (! empty($this->context['progress_percent'])) {
            $rows[] = [
                'label' => __('email.mlm.detail.progress'),
                'value' => $this->context['progress_percent'].'%',
            ];
        }

        if (! empty($this->context['days_remaining'])) {
            $rows[] = [
                'label' => __('email.mlm.detail.days_remaining'),
                'value' => (string) $this->context['days_remaining'],
            ];
        }

        if (! empty($this->context['reason'])) {
            $rows[] = [
                'label' => __('app.reason'),
                'value' => (string) $this->context['reason'],
            ];
        }

        if ($rows === []) {
            return '';
        }

        $html = '<div class="detail-block">';
        foreach ($rows as $row) {
            $html .= '<div class="detail-meta">'.$this->detailLine($row['label'], $row['value']).'</div>';
        }
        $html .= '</div>';

        return $html;
    }

    private function detailLine(string $label, string $value): string
    {
        if ($value === '') {
            return '';
        }

        return '<strong>'.e($label).' :</strong> '.e($value);
    }
}
