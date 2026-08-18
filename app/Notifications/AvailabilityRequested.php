<?php

namespace App\Notifications;

use App\Models\PropertyAvailabilityRequest;
use App\Support\PropertyRequestMailPresenter;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Support\Facades\URL;

class AvailabilityRequested extends BaseNotification
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

        $subject = "Availability Check: {$property->display_title}";
        $introText = "{$requestingAgent->name} is requesting to check the availability of a property you manage.";
        $contentHtml = PropertyRequestMailPresenter::joinBlocks(
            PropertyRequestMailPresenter::propertyMeta($property),
            PropertyRequestMailPresenter::line("Agent's Message", $this->availabilityRequest->message),
            '<br>Please respond within 8 business hours. If no response is given, this request will be escalated to admin.',
            PropertyRequestMailPresenter::denyLink($denyUrl),
        );
        $footerNote = 'You can also respond from the availability requests page in the CRM.';

        $build
            ->subject($subject.' - '.config('app.name'))
            ->view('mail.property.request', [
                'subject' => $subject,
                'badgeLabel' => 'Availability Request',
                'notifiableName' => $notifiable->name,
                'introText' => $introText,
                'content' => $contentHtml,
                'actionDescription' => 'Approve this availability check using the button below.',
                'actionText' => 'Approve Request',
                'url' => $approveUrl,
                'footerNote' => $footerNote,
            ]);

        $this->attachPropertyRequestPlunk($build, [
            'mailSubject' => $subject,
            'preheader' => $this->safePreheader($introText),
            'badgeLabel' => 'Availability Request',
            'notifiableName' => $notifiable->name,
            'introText' => $introText,
            'contentHtml' => $contentHtml,
            'actionDescription' => 'Approve this availability check using the button below.',
            'actionText' => 'Approve Request',
            'entityUrl' => $approveUrl,
            'footerNote' => $footerNote,
        ]);

        parent::resetLocale();

        return $build;
    }

    public function toArray($notifiable): array
    {
        $property = $this->availabilityRequest->property;
        $requestingAgent = $this->availabilityRequest->requestingAgent;

        return [
            'type' => 'availability_requested',
            'availability_request_id' => $this->availabilityRequest->id,
            'property_id' => $property->id,
            'property_reference' => $property->reference_code,
            'property_title' => $property->display_title,
            'requesting_agent_id' => $requestingAgent->id,
            'requesting_agent_name' => $requestingAgent->name,
            'message' => $this->availabilityRequest->message,
            'icon' => 'home',
            'heading' => 'Availability Check Requested',
            'description' => "{$requestingAgent->name} requests availability check for {$property->display_title}",
        ];
    }
}
