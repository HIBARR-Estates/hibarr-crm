<?php

namespace App\Notifications;

use App\Models\PropertyPublishRequest;
use App\Support\PropertyRequestMailPresenter;
use Illuminate\Notifications\Messages\MailMessage;

/**
 * Sent to all Sales Managers when an agent submits a publish request.
 */
class PublishRequestSubmitted extends BaseNotification
{
    private PropertyPublishRequest $publishRequest;

    public function __construct(PropertyPublishRequest $publishRequest)
    {
        $this->publishRequest = $publishRequest->load(['property', 'requestingAgent']);
        $this->company = $publishRequest->property?->company ?? null;
        $this->initUnsRouting();
    }

    public function via($notifiable): array
    {
        if (! $this->publishRequest->property || ! $this->publishRequest->requestingAgent) {
            return ['database'];
        }

        return ['database', 'mail'];
    }

    public function toMail($notifiable): MailMessage
    {
        $property = $this->publishRequest->property;
        $agent = $this->publishRequest->requestingAgent;

        if (! $property || ! $agent) {
            return $this->build($notifiable);
        }

        $build = $this->build($notifiable);

        $subject = "Publish Request: {$property->display_title}";
        $introText = "{$agent->name} has requested to publish a property.";
        $contentHtml = PropertyRequestMailPresenter::joinBlocks(
            PropertyRequestMailPresenter::propertyMeta($property, false),
            PropertyRequestMailPresenter::line("Agent's Note", $this->publishRequest->message),
            'Please review and approve or reject this request.',
        );
        $actionUrl = $this->modifyUrl(route('publish-requests.index'));

        $build
            ->subject($subject.' - '.config('app.name'))
            ->view('mail.property.request', [
                'subject' => $subject,
                'badgeLabel' => 'Publish Request',
                'notifiableName' => $notifiable->name,
                'introText' => $introText,
                'content' => $contentHtml,
                'actionDescription' => 'Review pending publish requests in the CRM.',
                'actionText' => 'Review Publish Requests',
                'url' => $actionUrl,
            ]);

        $this->attachPropertyRequestPlunk($build, [
            'mailSubject' => $subject,
            'preheader' => $this->safePreheader($introText),
            'badgeLabel' => 'Publish Request',
            'notifiableName' => $notifiable->name,
            'introText' => $introText,
            'contentHtml' => $contentHtml,
            'actionDescription' => 'Review pending publish requests in the CRM.',
            'actionText' => 'Review Publish Requests',
            'entityUrl' => $actionUrl,
            'footerNote' => '',
        ]);

        parent::resetLocale();

        return $build;
    }

    public function toArray($notifiable): array
    {
        $property = $this->publishRequest->property;
        $agent = $this->publishRequest->requestingAgent;

        return [
            'type' => 'publish_request_submitted',
            'publish_request_id' => $this->publishRequest->id,
            'property_id' => $property->id,
            'property_reference' => $property->reference_code,
            'property_title' => $property->display_title,
            'requesting_user_id' => $agent->id,
            'requesting_user_name' => $agent->name,
            'icon' => 'global',
            'heading' => 'New Publish Request',
            'description' => "{$agent->name} wants to publish: {$property->display_title}",
        ];
    }
}
