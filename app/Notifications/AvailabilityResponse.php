<?php

namespace App\Notifications;

use App\Models\PropertyAvailabilityRequest;
use App\Support\PropertyRequestMailPresenter;
use Illuminate\Notifications\Messages\MailMessage;

class AvailabilityResponse extends BaseNotification
{
    private PropertyAvailabilityRequest $availabilityRequest;

    public function __construct(PropertyAvailabilityRequest $availabilityRequest)
    {
        $this->availabilityRequest = $availabilityRequest->load(['property', 'responsibleAgent']);
        $this->company = $availabilityRequest->property->company ?? null;
        $this->initUnsRouting();
    }

    public function via($notifiable): array
    {
        return ['database', 'mail'];
    }

    public function toMail($notifiable): MailMessage
    {
        $build = $this->build($notifiable);
        $property = $this->availabilityRequest->property;
        $isApproved = $this->availabilityRequest->status === PropertyAvailabilityRequest::STATUS_APPROVED;
        $statusLabel = $isApproved ? 'Approved' : 'Denied';

        $subject = "Availability Request {$statusLabel}: {$property->display_title}";

        if ($isApproved) {
            $introText = 'Great news! Your availability request for the following property has been approved.';
            $contentHtml = PropertyRequestMailPresenter::joinBlocks(
                PropertyRequestMailPresenter::propertyMeta($property),
                PropertyRequestMailPresenter::line('Response Message', $this->availabilityRequest->response_message),
                'You may now proceed with presenting this property to your customer.',
            );
            $actionText = 'View Property';
            $actionUrl = $this->modifyUrl(route('properties.show', $property->id));
            $actionDescription = 'Click the button below to view the property.';
        } else {
            $introText = 'Your availability request for the following property has been denied.';
            $contentHtml = PropertyRequestMailPresenter::joinBlocks(
                PropertyRequestMailPresenter::propertyMeta($property, false),
                PropertyRequestMailPresenter::line('Reason', $this->availabilityRequest->response_message),
                'Please consider other properties for your customer.',
            );
            $actionText = '';
            $actionUrl = '';
            $actionDescription = '';
        }

        $build
            ->subject($subject.' - '.config('app.name'))
            ->view('mail.property.request', [
                'subject' => $subject,
                'badgeLabel' => 'Availability Response',
                'notifiableName' => $notifiable->name,
                'introText' => $introText,
                'content' => $contentHtml,
                'actionDescription' => $actionDescription,
                'actionText' => $actionText,
                'url' => $actionUrl,
            ]);

        if ($actionText !== '' && $actionUrl !== '') {
            $this->attachPropertyRequestReviewedPlunk($build, [
                'mailSubject' => $subject,
                'preheader' => $this->safePreheader($introText),
                'badgeLabel' => 'Availability Response',
                'notifiableName' => $notifiable->name,
                'introText' => $introText,
                'contentHtml' => $contentHtml,
                'actionDescription' => $actionDescription,
                'actionText' => $actionText,
                'entityUrl' => $actionUrl,
            ]);
        }

        parent::resetLocale();

        return $build;
    }

    public function toArray($notifiable): array
    {
        $property = $this->availabilityRequest->property;
        $isApproved = $this->availabilityRequest->status === PropertyAvailabilityRequest::STATUS_APPROVED;

        return [
            'type' => 'availability_response',
            'availability_request_id' => $this->availabilityRequest->id,
            'property_id' => $property->id,
            'property_reference' => $property->reference_code,
            'property_title' => $property->display_title,
            'status' => $this->availabilityRequest->status,
            'response_message' => $this->availabilityRequest->response_message,
            'icon' => $isApproved ? 'check-circle' : 'x-circle',
            'heading' => $isApproved ? 'Availability Request Approved' : 'Availability Request Denied',
            'description' => $isApproved
                ? "Your availability request for {$property->display_title} has been approved"
                : "Your availability request for {$property->display_title} has been denied",
        ];
    }
}
