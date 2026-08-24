<?php

namespace App\Notifications;

use App\Models\PropertyAvailabilityRequest;
use App\Support\PropertyRequestMailPresenter;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Support\Facades\URL;

class AvailabilityEscalationReminder extends BaseNotification
{
    private PropertyAvailabilityRequest $availabilityRequest;

    public function __construct(PropertyAvailabilityRequest $availabilityRequest)
    {
        $this->availabilityRequest = $availabilityRequest->load(['property', 'requestingAgent']);
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
        $requestingAgent = $this->availabilityRequest->requestingAgent;

        $approveUrl = URL::signedRoute('availability-requests.respond-email', [
            'id' => $this->availabilityRequest->id,
            'action' => 'approve',
        ]);
        $denyUrl = URL::signedRoute('availability-requests.respond-email', [
            'id' => $this->availabilityRequest->id,
            'action' => 'deny',
        ]);

        $subject = "REMINDER: Pending Availability Request - {$property->display_title}";
        $introText = 'You have an availability request that has been pending for over 8 business hours and has been escalated to admin.';
        $contentHtml = PropertyRequestMailPresenter::joinBlocks(
            PropertyRequestMailPresenter::propertyMeta($property, false),
            PropertyRequestMailPresenter::line('Requesting Agent', $requestingAgent->name),
            PropertyRequestMailPresenter::line('Requested At', $this->availabilityRequest->created_at->format('M d, Y H:i')),
            'Please respond to this request as soon as possible.',
            PropertyRequestMailPresenter::denyLink($denyUrl),
        );

        $build
            ->subject($subject.' - '.config('app.name'))
            ->view('mail.property.request', [
                'subject' => $subject,
                'badgeLabel' => 'Availability Reminder',
                'notifiableName' => $notifiable->name,
                'introText' => $introText,
                'content' => $contentHtml,
                'actionDescription' => 'Approve this availability check using the button below.',
                'actionText' => 'Approve Request',
                'url' => $approveUrl,
            ]);

        $this->attachPropertyRequestPlunk($build, [
            'mailSubject' => $subject,
            'preheader' => $this->safePreheader($introText),
            'badgeLabel' => 'Availability Reminder',
            'notifiableName' => $notifiable->name,
            'introText' => $introText,
            'contentHtml' => $contentHtml,
            'actionDescription' => 'Approve this availability check using the button below.',
            'actionText' => 'Approve Request',
            'entityUrl' => $approveUrl,
            'footerNote' => '',
        ]);

        parent::resetLocale();

        return $build;
    }

    public function toArray($notifiable): array
    {
        $property = $this->availabilityRequest->property;

        return [
            'type' => 'availability_escalation_reminder',
            'availability_request_id' => $this->availabilityRequest->id,
            'property_id' => $property->id,
            'property_reference' => $property->reference_code,
            'property_title' => $property->display_title,
            'icon' => 'clock',
            'heading' => 'Overdue Availability Request',
            'description' => "Your availability request for {$property->display_title} is overdue and has been escalated",
        ];
    }
}
