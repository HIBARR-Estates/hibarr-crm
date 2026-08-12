<?php

namespace App\Notifications;

use App\Models\EmailNotificationSetting;
use App\Models\Lead;
use App\Models\User;
use App\Scopes\ActiveScope;

class LeadOwnerAssigned extends BaseNotification
{
    private Lead $lead;
    private ?int $previousOwnerId;
    private string $previousOwnerName;
    private string $assignedAt;
    private ?EmailNotificationSetting $emailSetting;

    public function __construct(Lead $lead, ?int $previousOwnerId = null)
    {
        $this->lead = $lead;
        $this->company = $this->lead->company;
        $this->previousOwnerId = $previousOwnerId;
        $this->previousOwnerName = $previousOwnerId
            ? (User::withoutGlobalScope(ActiveScope::class)->find($previousOwnerId)?->name ?? 'Unassigned')
            : 'Unassigned';
        $this->assignedAt = now()->format($this->company?->date_format ?? 'Y-m-d');
        $this->emailSetting = $this->company
            ? EmailNotificationSetting::where('company_id', $this->company->id)
                ->where('slug', 'lead-notification')
                ->first()
            : null;
        $this->initUnsRouting();
    }

    public function via($notifiable)
    {
        $via = ['database'];

        if (
            $notifiable->status === 'active' &&
            $this->emailSetting &&
            $this->emailSetting->send_email === 'yes' &&
            $notifiable->email_notifications &&
            $notifiable->email !== ''
        ) {
            $via[] = 'mail';
        }

        return $via;
    }

    public function toMail($notifiable)
    {
        $build = parent::build($notifiable);
        $url = route('lead-contact.show', $this->lead->id);
        $url = getDomainSpecificUrl($url, $this->company);

        $leadName = $this->safeMailText($this->lead->client_name ?? '', 200);
        $leadEmail = $this->safeMailText($this->lead->client_email ?? '', 320);

        $contentParts = [
            'A lead has been assigned to you.',
            __('modules.lead.clientName') . ': ' . $leadName,
        ];

        if ($leadEmail !== '') {
            $contentParts[] = __('modules.lead.clientEmail') . ': ' . $leadEmail;
        }

        $preheader = $this->safePreheader($this->assignmentText());

        $build
            ->subject('Lead owner assigned - ' . config('app.name'))
            ->view('mail.lead-assigned', [
                'url' => $url,
                'content' => implode('<br>', $contentParts),
                'preheader' => $preheader,
                'themeColor' => $this->company?->header_color,
                'actionText' => 'View Lead',
                'notifiableName' => $notifiable->name,
            ]);

        $this->attachPlunkTemplate($build, 'cde4d601-d358-45e5-9782-1e79d5c4f9f7', [
            'preheader'         => $preheader,
            'leadName'          => $leadName,
            'leadEmail'         => $leadEmail,
            'previousOwnerName' => $this->previousOwnerName,
            'assignedAt'        => $this->assignedAt,
            'leadUrl'           => $url,
        ]);

        parent::resetLocale();

        return $build;
    }

    public function toArray($notifiable)
    {
        return [
            'id' => $this->lead->id,
            'name' => $this->safeMailText($this->lead->client_name ?? '', 200),
            'previous_owner_id' => $this->previousOwnerId,
            'new_owner_id' => $notifiable->id,
            'added_by' => $this->lead->added_by,
            'title' => __('email.leadAgentAssigned.subject'),
            'text' => $this->safeMailText($this->assignmentText(), 240),
        ];
    }

    /**
     * Title + the notification's compact subject line already say "assigned as
     * lead agent" + the lead's name, so once an AI summary exists, this detail
     * text is the summary alone — repeating the base sentence there too would
     * just be the same redundant boilerplate again.
     */
    private function assignmentText(): string
    {
        $leadName = $this->safeMailText($this->lead->client_name ?? '', 200);
        $base = $leadName !== ''
            ? __('email.leadAgentAssigned.text', ['leadName' => $leadName])
            : __('email.leadAgentAssigned.subject').'.';

        $snippet = $this->aiSummarySnippet($this->lead);

        return $snippet ?: $base;
    }
}

