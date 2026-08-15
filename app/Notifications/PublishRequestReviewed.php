<?php

namespace App\Notifications;

use App\Models\PropertyPublishRequest;
use App\Support\PropertyRequestMailPresenter;
use Illuminate\Notifications\Messages\MailMessage;

/**
 * Sent to the requesting agent when a Sales Manager approves or rejects their publish request.
 */
class PublishRequestReviewed extends BaseNotification
{
    private PropertyPublishRequest $publishRequest;

    public function __construct(PropertyPublishRequest $publishRequest)
    {
        $this->publishRequest = $publishRequest->load(['property', 'reviewer']);
        $this->company = $publishRequest->property?->company ?? null;
        $this->initUnsRouting();
    }

    public function via($notifiable): array
    {
        return ['database', 'mail'];
    }

    public function toMail($notifiable): MailMessage
    {
        $property = $this->publishRequest->property;
        $reviewer = $this->publishRequest->reviewer;
        $isApproved = $this->publishRequest->isApproved();
        $status = $isApproved ? 'Approved' : 'Rejected';

        $build = $this->build($notifiable);

        $subject = "Publish Request {$status}: {$property->display_title}";
        $introText = "Your publish request has been {$status}.";
        $contentHtml = PropertyRequestMailPresenter::joinBlocks(
            PropertyRequestMailPresenter::propertyMeta($property, false),
            PropertyRequestMailPresenter::line('Reviewed by', $reviewer->name),
            PropertyRequestMailPresenter::line("Reviewer's Note", $this->publishRequest->response_message),
            $isApproved
                ? 'Your property is now published and visible to the public.'
                : 'Please review the feedback and update your property before requesting again.',
        );
        $actionUrl = $this->modifyUrl(route('properties.show', $property->id));

        $build
            ->subject($subject.' - '.config('app.name'))
            ->view('mail.property.request', [
                'subject' => $subject,
                'badgeLabel' => 'Publish Review',
                'notifiableName' => $notifiable->name,
                'introText' => $introText,
                'content' => $contentHtml,
                'actionDescription' => 'View the property in the CRM.',
                'actionText' => 'View Property',
                'url' => $actionUrl,
            ]);

        $this->attachPropertyRequestReviewedPlunk($build, [
            'mailSubject' => $subject,
            'preheader' => $this->safePreheader($introText),
            'badgeLabel' => 'Publish Review',
            'notifiableName' => $notifiable->name,
            'introText' => $introText,
            'contentHtml' => $contentHtml,
            'actionDescription' => 'View the property in the CRM.',
            'actionText' => 'View Property',
            'entityUrl' => $actionUrl,
        ]);

        parent::resetLocale();

        return $build;
    }

    public function toArray($notifiable): array
    {
        $property = $this->publishRequest->property;
        $reviewer = $this->publishRequest->reviewer;
        $isApproved = $this->publishRequest->isApproved();
        $status = $isApproved ? 'approved' : 'rejected';

        return [
            'type' => 'publish_request_reviewed',
            'publish_request_id' => $this->publishRequest->id,
            'property_id' => $property->id,
            'property_reference' => $property->reference_code,
            'property_title' => $property->display_title,
            'reviewer_id' => $reviewer->id,
            'reviewer_name' => $reviewer->name,
            'result' => $status,
            'response_message' => $this->publishRequest->response_message,
            'icon' => $isApproved ? 'check-circle' : 'close-circle',
            'heading' => 'Publish Request '.ucfirst($status),
            'description' => "Your property \"{$property->display_title}\" was {$status} by {$reviewer->name}.",
        ];
    }
}
