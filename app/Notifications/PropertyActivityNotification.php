<?php

namespace App\Notifications;

use App\Enums\PropertyActivityType;
use App\Models\EmailNotificationSetting;
use App\Models\Property;

class PropertyActivityNotification extends BaseNotification
{
    private Property $property;

    private PropertyActivityType $activityType;

    private array $data;

    private ?EmailNotificationSetting $emailSetting;

    public function __construct(Property $property, PropertyActivityType $activityType, array $data = [])
    {
        $this->property = $property;
        $this->activityType = $activityType;
        $this->data = $data;
        $this->company = $property->company;
        $this->emailSetting = $this->company
            ? EmailNotificationSetting::where('company_id', $this->company->id)
                ->where('slug', $this->activityType->emailSettingSlug())
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

        $url = getDomainSpecificUrl(route('properties.show', $this->property->id), $this->company);
        $subject = $this->getEmailSubject();
        $content = $this->getEmailContent();
        $actionText = __('app.view').' '.__('app.property');
        $introText = $this->safeMailText($this->getNotificationText(), 500);

        $build
            ->subject($subject.' - '.config('app.name'))
            ->view('mail.property.activity', [
                'url' => $url,
                'content' => $content,
                'preheader' => $this->safePreheader($subject),
                'subject' => $subject,
                'actionText' => $actionText,
                'introText' => $introText,
                'notifiableName' => $notifiable->name,
            ]);

        $this->attachEntityActivityPlunk($build, [
            'mailSubject' => $subject,
            'preheader' => $introText,
            'badgeLabel' => 'Property Activity',
            'notifiableName' => $notifiable->name,
            'introText' => $introText,
            'contentHtml' => $content,
            'actionDescription' => __('Click the button below to view the property details.'),
            'actionText' => $actionText,
            'entityUrl' => $this->data['action_url'] ?? $url,
        ]);

        parent::resetLocale();

        return $build;
    }

    public function toArray($notifiable): array
    {
        return [
            'id' => $this->property->id,
            'property_id' => $this->property->id,
            'property_title' => $this->propertyTitle(),
            'property_reference' => $this->property->reference_code,
            'activity_type' => $this->activityType->value,
            'activity_label' => $this->activityType->label(),
            'activity_icon' => $this->activityType->icon(),
            'heading' => $this->getNotificationHeading(),
            'text' => $this->getNotificationText(),
            'triggered_by' => $this->data['triggered_by_name'] ?? 'System',
            'triggered_by_id' => $this->data['triggered_by_id'] ?? null,
            'action_url' => $this->data['action_url'] ?? null,
            'additional_data' => $this->getAdditionalDataForStorage(),
        ];
    }

    protected function getNotificationHeading(): string
    {
        $title = $this->propertyTitle();

        return match ($this->activityType) {
            PropertyActivityType::CREATED => "New property: {$title}",
            PropertyActivityType::PUBLISHED => "Property published: {$title}",
            PropertyActivityType::UNPUBLISHED => "Property unpublished: {$title}",
            PropertyActivityType::STATUS_CHANGED => "Property status changed: {$title}",
            PropertyActivityType::PRICE_CHANGED => "Property price changed: {$title}",
            PropertyActivityType::AGENT_ASSIGNED => "Property assigned: {$title}",
            PropertyActivityType::DOCUMENT_UPLOADED => "Document uploaded: {$title}",
            PropertyActivityType::ARCHIVED => "Property archived: {$title}",
        };
    }

    protected function getNotificationText(): string
    {
        $triggeredBy = $this->data['triggered_by_name'] ?? 'Someone';
        $title = $this->propertyTitle();

        return match ($this->activityType) {
            PropertyActivityType::CREATED => "{$triggeredBy} added property {$title}",
            PropertyActivityType::PUBLISHED => "{$triggeredBy} published {$title}",
            PropertyActivityType::UNPUBLISHED => "{$triggeredBy} unpublished {$title}",
            PropertyActivityType::STATUS_CHANGED => "{$triggeredBy} changed status of {$title} from "
                .($this->data['old_status'] ?? 'unknown').' to '.($this->data['new_status'] ?? 'unknown'),
            PropertyActivityType::PRICE_CHANGED => "{$triggeredBy} updated the price of {$title}",
            PropertyActivityType::AGENT_ASSIGNED => "{$triggeredBy} assigned {$title} to "
                .($this->data['agent_name'] ?? 'an agent'),
            PropertyActivityType::DOCUMENT_UPLOADED => "{$triggeredBy} uploaded "
                .($this->data['file_name'] ?? 'a document')." to {$title}",
            PropertyActivityType::ARCHIVED => "{$triggeredBy} archived {$title}",
        };
    }

    protected function getEmailSubject(): string
    {
        $title = $this->safeMailText($this->propertyTitle(), 200);

        return match ($this->activityType) {
            PropertyActivityType::CREATED => "New Property: {$title}",
            PropertyActivityType::PUBLISHED => "Property Published: {$title}",
            PropertyActivityType::UNPUBLISHED => "Property Unpublished: {$title}",
            PropertyActivityType::STATUS_CHANGED => "Property Status Changed: {$title}",
            PropertyActivityType::PRICE_CHANGED => "Property Price Changed: {$title}",
            PropertyActivityType::AGENT_ASSIGNED => "Property Assigned: {$title}",
            PropertyActivityType::DOCUMENT_UPLOADED => "Document Uploaded: {$title}",
            PropertyActivityType::ARCHIVED => "Property Archived: {$title}",
        };
    }

    protected function getEmailContent(): string
    {
        $lines = [];
        $triggeredBy = $this->data['triggered_by_name'] ?? 'Someone';
        $title = $this->safeMailText($this->propertyTitle(), 200);

        $lines[] = '<strong>Property:</strong> '.$title;
        if ($this->property->reference_code) {
            $lines[] = '<strong>Reference:</strong> '.$this->safeMailText($this->property->reference_code, 100);
        }
        $lines[] = '<strong>'.__('app.changedBy').":</strong> {$triggeredBy}";
        $lines[] = '<br>';

        switch ($this->activityType) {
            case PropertyActivityType::STATUS_CHANGED:
                $lines[] = '<strong>Previous status:</strong> '
                    .$this->safeMailText($this->data['old_status'] ?? 'Unknown', 100);
                $lines[] = '<strong>New status:</strong> '
                    .$this->safeMailText($this->data['new_status'] ?? 'Unknown', 100);
                break;
            case PropertyActivityType::PRICE_CHANGED:
                $lines[] = '<strong>Previous price:</strong> '
                    .$this->safeMailText((string) ($this->data['old_price'] ?? '—'), 100);
                $lines[] = '<strong>New price:</strong> '
                    .$this->safeMailText((string) ($this->data['new_price'] ?? '—'), 100);
                break;
            case PropertyActivityType::AGENT_ASSIGNED:
                $lines[] = '<strong>Assigned agent:</strong> '
                    .$this->safeMailText($this->data['agent_name'] ?? 'Unknown', 100);
                break;
            case PropertyActivityType::DOCUMENT_UPLOADED:
                $lines[] = '<strong>Document:</strong> '
                    .$this->safeMailText($this->data['file_name'] ?? 'Unknown', 200);
                break;
        }

        return implode('<br>', $lines);
    }

    protected function getAdditionalDataForStorage(): array
    {
        $keys = match ($this->activityType) {
            PropertyActivityType::STATUS_CHANGED => ['old_status', 'new_status'],
            PropertyActivityType::PRICE_CHANGED => ['old_price', 'new_price'],
            PropertyActivityType::AGENT_ASSIGNED => ['agent_id', 'agent_name'],
            PropertyActivityType::DOCUMENT_UPLOADED => ['file_id', 'file_name'],
            default => [],
        };

        $relevant = [];
        foreach ($keys as $key) {
            if (isset($this->data[$key])) {
                $relevant[$key] = $this->data[$key];
            }
        }

        return $relevant;
    }

    protected function propertyTitle(): string
    {
        return trim((string) ($this->property->display_title ?? $this->property->title ?? ''))
            ?: ($this->property->reference_code ?? 'Property');
    }
}
