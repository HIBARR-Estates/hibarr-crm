<?php

namespace App\Notifications;

use App\Models\PropertyAvailabilityRequest;
use App\Support\PropertyRequestMailPresenter;
use Illuminate\Notifications\Messages\MailMessage;

class AvailabilityEscalation extends BaseNotification
{
    private PropertyAvailabilityRequest $availabilityRequest;

    public function __construct(PropertyAvailabilityRequest $availabilityRequest)
    {
        $this->availabilityRequest = $availabilityRequest->load(['property', 'requestingAgent', 'responsibleAgent']);
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
        $responsibleAgent = $this->availabilityRequest->responsibleAgent;

        $subject = "ESCALATION: Availability Request Overdue - {$property->display_title}";
        $introText = 'An availability request has not been responded to within the required 8 business hours and requires your attention.';
        $contentHtml = PropertyRequestMailPresenter::joinBlocks(
            PropertyRequestMailPresenter::propertyMeta($property, false),
            PropertyRequestMailPresenter::line('Requesting Agent', $requestingAgent->name),
            PropertyRequestMailPresenter::line('Responsible Agent', $responsibleAgent->name),
            PropertyRequestMailPresenter::line('Requested At', $this->availabilityRequest->created_at->format('M d, Y H:i')),
            PropertyRequestMailPresenter::line('Escalated At', $this->availabilityRequest->escalated_at?->format('M d, Y H:i')),
            PropertyRequestMailPresenter::line('Original Message', $this->availabilityRequest->message),
            'Please review and respond to this request as an administrator.',
        );
        $actionUrl = $this->modifyUrl(route('availability-requests.show', $this->availabilityRequest->id));

        $build
            ->subject($subject.' - '.config('app.name'))
            ->view('mail.property.request', [
                'subject' => $subject,
                'badgeLabel' => 'Availability Escalation',
                'notifiableName' => $notifiable->name,
                'introText' => $introText,
                'content' => $contentHtml,
                'actionDescription' => 'Review this escalated request in the CRM.',
                'actionText' => 'View Request',
                'url' => $actionUrl,
            ]);

        $this->attachPropertyRequestPlunk($build, [
            'mailSubject' => $subject,
            'preheader' => $this->safePreheader($introText),
            'badgeLabel' => 'Availability Escalation',
            'notifiableName' => $notifiable->name,
            'introText' => $introText,
            'contentHtml' => $contentHtml,
            'actionDescription' => 'Review this escalated request in the CRM.',
            'actionText' => 'View Request',
            'entityUrl' => $actionUrl,
            'footerNote' => '',
        ]);

        parent::resetLocale();

        return $build;
    }

    public function toArray($notifiable): array
    {
        $property = $this->availabilityRequest->property;
        $requestingAgent = $this->availabilityRequest->requestingAgent;
        $responsibleAgent = $this->availabilityRequest->responsibleAgent;

        return [
            'type' => 'availability_escalation',
            'availability_request_id' => $this->availabilityRequest->id,
            'property_id' => $property->id,
            'property_reference' => $property->reference_code,
            'property_title' => $property->display_title,
            'requesting_agent_id' => $requestingAgent->id,
            'requesting_agent_name' => $requestingAgent->name,
            'responsible_agent_id' => $responsibleAgent->id,
            'responsible_agent_name' => $responsibleAgent->name,
            'icon' => 'alert-triangle',
            'heading' => 'Availability Request Escalated',
            'description' => "Overdue availability request for {$property->display_title} by {$requestingAgent->name} (assigned to {$responsibleAgent->name})",
        ];
    }
}
