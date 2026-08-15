<?php

namespace App\Notifications;

use App\Enums\LeadActivityType;
use App\Models\EmailNotificationSetting;
use App\Models\Lead;
use App\Support\EntityActivityMailBuilder;

class LeadActivityNotification extends BaseNotification
{
    private Lead $lead;

    private LeadActivityType $activityType;

    private array $data;

    private ?EmailNotificationSetting $emailSetting;

    public function __construct(Lead $lead, LeadActivityType $activityType, array $data = [])
    {
        $this->lead = $lead;
        $this->activityType = $activityType;
        $this->data = $data;
        $this->company = $lead->company;
        $this->emailSetting = $this->company
            ? EmailNotificationSetting::where('company_id', $this->company->id)
                ->where('slug', 'lead-notification')
                ->first()
            : null;

        $this->initUnsRouting();
    }

    public function via($notifiable): array
    {
        $triggeredById = $this->data['triggered_by_id'] ?? null;
        if ($triggeredById !== null && (int) $notifiable->id === (int) $triggeredById) {
            return [];
        }

        $via = ['database'];

        if ($this->suppressBulkTransactionalEmails) {
            return $via;
        }

        if (
            $this->emailSetting
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

        $url = getDomainSpecificUrl(route('lead-contact.show', $this->lead->id), $this->company);
        $subject = $this->getEmailSubject();
        $actionText = __('email.leadDeleted.action');
        $introText = $this->safeMailText($this->getNotificationText(), 500);
        $detailHtml = $this->getEmailDetailHtml();
        $content = $this->getEmailContent();
        if ($content !== '') {
            $content = '<div class="callout">'.$content.'</div>';
        }

        $build
            ->subject($subject.' - '.config('app.name'))
            ->view('mail.lead.activity', [
                'url' => $url,
                'content' => $content,
                'detailHtml' => $detailHtml,
                'preheader' => $this->safePreheader($introText),
                'subject' => $subject,
                'actionText' => $actionText,
                'introText' => $introText,
                'notifiableName' => $notifiable->name,
            ]);

        $this->attachEntityActivityPlunk($build, [
            'mailSubject' => $subject,
            'preheader' => $this->safePreheader($introText),
            'badgeLabel' => 'Lead Activity',
            'notifiableName' => $notifiable->name,
            'introText' => $introText,
            'detailHtml' => $detailHtml,
            'contentHtml' => $content,
            'actionDescription' => __('Click the button below to view the lead details.'),
            'actionText' => $actionText,
            'entityUrl' => $url,
        ]);

        parent::resetLocale();

        return $build;
    }

    public function toArray($notifiable): array
    {
        return [
            'id' => $this->lead->id,
            'lead_id' => $this->lead->id,
            'lead_name' => $this->lead->client_name,
            'activity_type' => $this->activityType->value,
            'activity_label' => $this->activityType->label(),
            'activity_icon' => $this->activityType->icon(),
            'heading' => $this->getNotificationHeading(),
            'text' => $this->getNotificationText(),
            'triggered_by' => $this->data['triggered_by_name'] ?? 'System',
            'triggered_by_id' => $this->data['triggered_by_id'] ?? null,
            'additional_data' => $this->getAdditionalDataForStorage(),
        ];
    }

    protected function getNotificationHeading(): string
    {
        $leadName = $this->leadName();

        return match ($this->activityType) {
            LeadActivityType::NOTE_ADDED => "Note added to lead: {$leadName}",
            LeadActivityType::NOTE_UPDATED => "Note updated on lead: {$leadName}",
            LeadActivityType::NOTE_DELETED => "Note deleted from lead: {$leadName}",
            LeadActivityType::FILE_UPLOADED => "File uploaded to lead: {$leadName}",
            LeadActivityType::FILE_UPDATED => "File updated on lead: {$leadName}",
            LeadActivityType::FILE_DELETED => "File deleted from lead: {$leadName}",
        };
    }

    protected function getNotificationText(): string
    {
        $triggeredBy = $this->data['triggered_by_name'] ?? 'Someone';
        $leadName = $this->safeMailText($this->leadName(), 200);
        $fieldLabel = $this->fileFieldLabel();

        return match ($this->activityType) {
            LeadActivityType::NOTE_ADDED => "{$triggeredBy} added a note on {$leadName}.",
            LeadActivityType::NOTE_UPDATED => "{$triggeredBy} updated a note on {$leadName}.",
            LeadActivityType::NOTE_DELETED => "{$triggeredBy} deleted a note on {$leadName}.",
            LeadActivityType::FILE_UPLOADED => $fieldLabel
                ? "{$triggeredBy} uploaded a file to {$fieldLabel} on {$leadName}."
                : "{$triggeredBy} added a file to {$leadName}.",
            LeadActivityType::FILE_UPDATED => $fieldLabel
                ? "{$triggeredBy} updated a file on {$fieldLabel} for {$leadName}."
                : "{$triggeredBy} updated a file on {$leadName}.",
            LeadActivityType::FILE_DELETED => $fieldLabel
                ? "{$triggeredBy} removed a file from {$fieldLabel} on {$leadName}. This action cannot be undone."
                : "{$triggeredBy} removed a file from {$leadName}. This action cannot be undone.",
        };
    }

    protected function getEmailSubject(): string
    {
        $leadName = $this->safeMailText($this->leadName(), 200);

        return match ($this->activityType) {
            LeadActivityType::NOTE_ADDED => "New Note on Lead: {$leadName}",
            LeadActivityType::NOTE_UPDATED => "Note Updated on Lead: {$leadName}",
            LeadActivityType::NOTE_DELETED => "Note Deleted from Lead: {$leadName}",
            LeadActivityType::FILE_UPLOADED => "New File on Lead: {$leadName}",
            LeadActivityType::FILE_UPDATED => "File Updated on Lead: {$leadName}",
            LeadActivityType::FILE_DELETED => "File Deleted from Lead: {$leadName}",
        };
    }

    protected function getEmailDetailHtml(): string
    {
        $leadName = $this->safeMailText($this->leadName(), 200);

        return match ($this->activityType) {
            LeadActivityType::NOTE_ADDED,
            LeadActivityType::NOTE_UPDATED,
            LeadActivityType::NOTE_DELETED => EntityActivityMailBuilder::renderDetailBlock(
                $this->safeMailText($this->data['note_title'] ?? 'Untitled', 200),
                $leadName,
            ),
            LeadActivityType::FILE_UPLOADED,
            LeadActivityType::FILE_UPDATED,
            LeadActivityType::FILE_DELETED => $this->fileDetailHtml($leadName),
        };
    }

    protected function getEmailContent(): string
    {
        return '';
    }

    protected function fileDetailHtml(string $leadName): string
    {
        $fieldLabel = $this->fileFieldLabel();
        $warning = $this->activityType === LeadActivityType::FILE_DELETED;

        if ($fieldLabel !== null) {
            return EntityActivityMailBuilder::renderDetailBlock(
                $fieldLabel,
                $leadName,
                $warning ? __('This action cannot be undone.') : null,
                $warning,
            );
        }

        return EntityActivityMailBuilder::renderDetailBlock(
            null,
            $leadName,
            $warning ? __('This action cannot be undone.') : null,
            $warning,
        );
    }

    protected function fileFieldLabel(): ?string
    {
        $label = trim((string) ($this->data['field_label'] ?? ''));

        return $label !== '' ? $this->safeMailText($label, 200) : null;
    }

    protected function getAdditionalDataForStorage(): array
    {
        $keys = match ($this->activityType) {
            LeadActivityType::NOTE_ADDED,
            LeadActivityType::NOTE_UPDATED,
            LeadActivityType::NOTE_DELETED => ['note_id', 'note_title'],
            LeadActivityType::FILE_UPLOADED,
            LeadActivityType::FILE_UPDATED,
            LeadActivityType::FILE_DELETED => ['file_id', 'field_label'],
        };

        $relevant = [];
        foreach ($keys as $key) {
            if (isset($this->data[$key])) {
                $relevant[$key] = $this->data[$key];
            }
        }

        return $relevant;
    }

    protected function leadName(): string
    {
        return trim((string) ($this->lead->client_name ?? '')) ?: __('modules.lead.lead');
    }
}
