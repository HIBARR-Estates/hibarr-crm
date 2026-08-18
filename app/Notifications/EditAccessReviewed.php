<?php

namespace App\Notifications;

use App\Models\PropertyEditAccessRequest;
use App\Support\PropertyRequestMailPresenter;
use Illuminate\Notifications\Messages\MailMessage;

class EditAccessReviewed extends BaseNotification
{
    private PropertyEditAccessRequest $editAccessRequest;

    public function __construct(PropertyEditAccessRequest $editAccessRequest)
    {
        $this->editAccessRequest = $editAccessRequest->load(['property', 'responsibleAgent']);
        $this->company = $editAccessRequest->property->company ?? null;
        $this->initUnsRouting();
    }

    public function via($notifiable): array
    {
        return ['database', 'mail'];
    }

    public function toMail($notifiable): MailMessage
    {
        $build = $this->build($notifiable);
        $property = $this->editAccessRequest->property;
        $isApproved = $this->editAccessRequest->status === PropertyEditAccessRequest::STATUS_APPROVED;
        $statusLabel = $isApproved ? 'Approved' : 'Denied';

        $subject = "Edit Access {$statusLabel}: {$property->display_title}";

        if ($isApproved) {
            $introText = 'Your edit access request has been approved.';
            $contentHtml = PropertyRequestMailPresenter::joinBlocks(
                PropertyRequestMailPresenter::propertyMeta($property, false),
                PropertyRequestMailPresenter::line('Response Message', $this->editAccessRequest->response_message),
                'You can now edit public listing fields and manage assets on this property.',
            );
            $actionText = 'Edit Property';
            $actionUrl = $this->modifyUrl(route('properties.show', $property->id));
            $actionDescription = 'Open the property to start editing.';
        } else {
            $introText = 'Your edit access request has been denied.';
            $contentHtml = PropertyRequestMailPresenter::joinBlocks(
                PropertyRequestMailPresenter::propertyMeta($property, false),
                PropertyRequestMailPresenter::line('Reason', $this->editAccessRequest->response_message),
            );
            $actionText = '';
            $actionUrl = '';
            $actionDescription = '';
        }

        $build
            ->subject($subject.' - '.config('app.name'))
            ->view('mail.property.request', [
                'subject' => $subject,
                'badgeLabel' => 'Edit Access',
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
                'badgeLabel' => 'Edit Access',
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
        $property = $this->editAccessRequest->property;
        $isApproved = $this->editAccessRequest->status === PropertyEditAccessRequest::STATUS_APPROVED;

        return [
            'type' => 'edit_access_reviewed',
            'edit_access_request_id' => $this->editAccessRequest->id,
            'property_id' => $property->id,
            'property_reference' => $property->reference_code,
            'property_title' => $property->display_title,
            'status' => $this->editAccessRequest->status,
            'response_message' => $this->editAccessRequest->response_message,
            'icon' => $isApproved ? 'check-circle' : 'x-circle',
            'heading' => $isApproved ? 'Edit Access Approved' : 'Edit Access Denied',
            'description' => $isApproved
                ? "You can now edit {$property->display_title}"
                : "Your edit access request for {$property->display_title} was denied",
        ];
    }
}
