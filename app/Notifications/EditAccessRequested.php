<?php

namespace App\Notifications;

use App\Models\PropertyEditAccessRequest;
use App\Support\PropertyRequestMailPresenter;
use Illuminate\Notifications\Messages\MailMessage;

class EditAccessRequested extends BaseNotification
{
    private PropertyEditAccessRequest $editAccessRequest;

    public function __construct(PropertyEditAccessRequest $editAccessRequest)
    {
        $this->editAccessRequest = $editAccessRequest->load(['property', 'requestingAgent']);
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
        $requestingAgent = $this->editAccessRequest->requestingAgent;

        $subject = "Edit Access Request: {$property->display_title}";
        $introText = "{$requestingAgent->name} is requesting edit access to a property you manage.";
        $contentHtml = PropertyRequestMailPresenter::joinBlocks(
            PropertyRequestMailPresenter::propertyMeta($property, false),
            PropertyRequestMailPresenter::line("Agent's Message", $this->editAccessRequest->message),
            'Approve to grant the agent collaborator access to update public listing fields.',
        );
        $actionUrl = $this->modifyUrl(route('edit-access-requests.index'));

        $build
            ->subject($subject.' - '.config('app.name'))
            ->view('mail.property.request', [
                'subject' => $subject,
                'badgeLabel' => 'Edit Access Request',
                'notifiableName' => $notifiable->name,
                'introText' => $introText,
                'content' => $contentHtml,
                'actionDescription' => 'Review this edit access request in the CRM.',
                'actionText' => 'Review Request',
                'url' => $actionUrl,
            ]);

        $this->attachPropertyRequestPlunk($build, [
            'mailSubject' => $subject,
            'preheader' => $this->safePreheader($introText),
            'badgeLabel' => 'Edit Access Request',
            'notifiableName' => $notifiable->name,
            'introText' => $introText,
            'contentHtml' => $contentHtml,
            'actionDescription' => 'Review this edit access request in the CRM.',
            'actionText' => 'Review Request',
            'entityUrl' => $actionUrl,
            'footerNote' => '',
        ]);

        parent::resetLocale();

        return $build;
    }

    public function toArray($notifiable): array
    {
        $property = $this->editAccessRequest->property;
        $requestingAgent = $this->editAccessRequest->requestingAgent;

        return [
            'type' => 'edit_access_requested',
            'edit_access_request_id' => $this->editAccessRequest->id,
            'property_id' => $property->id,
            'property_reference' => $property->reference_code,
            'property_title' => $property->display_title,
            'requesting_agent_id' => $requestingAgent->id,
            'requesting_agent_name' => $requestingAgent->name,
            'message' => $this->editAccessRequest->message,
            'icon' => 'edit',
            'heading' => 'Edit Access Requested',
            'description' => "{$requestingAgent->name} requests edit access for {$property->display_title}",
        ];
    }
}
