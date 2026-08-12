<?php

namespace App\Notifications;

use App\Models\EmailNotificationSetting;
use App\Models\Deal;

class LeadAgentAssigned extends BaseNotification
{

    /**
     * Create a new notification instance.
     *
     * @return void
     */
    private $deal;
    private $emailSetting;
    private string $assignedByName;
    private string $assignedAt;

    public function __construct(Deal $deal)
    {
        $this->deal = $deal;
        $this->deal->loadMissing(['leadAgent', 'dealWatchers', 'contact', 'company', 'leadSource']);
        $this->company = $this->deal->company;
        $this->assignedByName = user()?->name ?? '';
        $this->assignedAt = now()->format($this->company->date_format);
        $this->emailSetting = EmailNotificationSetting::where('company_id', $this->company->id)->where('slug', 'lead-notification')->first();
        $this->initUnsRouting();
    }

    /**
     * Get the notification's delivery channels.
     *
     * @param mixed $notifiable
     * @return array
     */
    public function via($notifiable)
    {
        $via = array('database');

        // During bulk updates, suppress individual transactional emails.
        if ($this->suppressBulkTransactionalEmails) {
            return $via;
        }

        // Check if email setting exists and is enabled
        if ($this->emailSetting && $this->emailSetting->send_email == 'yes' && $notifiable->email_notifications && $notifiable->email != '') {
            array_push($via, 'mail');
        }

        return $via;
    }

    /**
     * Get the mail representation of the notification.
     *
     * @param mixed $notifiable
     * @return \Illuminate\Notifications\Messages\MailMessage
     */
    public function toMail($notifiable)
    {
        $build = parent::build($notifiable);
        $url = route('deals.show', $this->deal->id);
        $url = getDomainSpecificUrl($url, $this->company);

        $role = $this->resolveAssignmentRole($notifiable);
        $subject = $this->assignmentTitle($role);
        $preheader = $this->safePreheader($this->assignmentText($role));
        $actionText = $this->assignmentAction($role);

        $contact = $this->deal->contact;
        $leadName = $this->safeMailText($contact?->client_name ?? $contact?->client_name_salutation ?? '', 200);
        $leadEmail = $this->safeMailText($contact?->client_email ?? '', 320);
        $dealName = $this->safeMailText($this->deal->name ?? '', 200);

        $leadEmailLabel = __('modules.lead.clientEmail') . ': ';
        $clientEmail = $leadEmail !== '' ? $leadEmailLabel : '';
        $content = $subject . '<br>' .__('modules.deal.dealName') . ': '  . $dealName . '<br>' .  __('modules.lead.clientName') . ': '  . $leadName . '<br>' . $clientEmail . $leadEmail;

        $build
            ->subject($subject . ' - ' . config('app.name'))
            ->view('mail.deal-assigned', [
                'url' => $url,
                'content' => $content,
                'preheader' => $preheader,
                'intro' => $preheader,
                'themeColor' => $this->company->header_color,
                'actionText' => $actionText,
                'notifiableName' => $notifiable->name
            ]);

        $this->attachPlunkTemplate($build, '336e4f34-69bf-4a4f-92af-96e318a80548', [
            'preheader'      => $preheader,
            'assignedByName' => $this->assignedByName,
            'leadName'       => $leadName,
            'leadEmail'      => $leadEmail,
            'dealName'       => $dealName,
            'assignedAt'     => $this->assignedAt,
            'leadUrl'        => $url,
            'assignmentRole' => $role,
        ]);

        parent::resetLocale();

        return $build;
    }

    /**
     * Get the array representation of the notification.
     *
     * @param mixed $notifiable
     * @return array
     */
    //phpcs:ignore
    public function toArray($notifiable)
    {
        $assignmentRole = $this->resolveAssignmentRole($notifiable);

        return [
            'id' => $this->deal->id,
            'deal_id' => $this->deal->id,
            'name' => $this->safeMailText($this->deal->name ?? '', 200),
            'source' => $this->deal->leadSource?->name,
            'agent_id' => $notifiable->id,
            'added_by' => $this->deal->added_by,
            'assignment_role' => $assignmentRole,
            'title' => $this->assignmentTitle($assignmentRole),
            'text' => $this->safeMailText($this->assignmentText($assignmentRole), 240),
        ];
    }

    private function resolveAssignmentRole($notifiable): string
    {
        if ($this->deal->leadAgent && (int) $this->deal->leadAgent->user_id === (int) $notifiable->id) {
            return 'deal_agent';
        }

        if ($this->deal->dealWatchers->contains('id', $notifiable->id)) {
            return 'deal_watcher';
        }

        return 'new_deal';
    }

    private function assignmentTitle(string $assignmentRole): string
    {
        return match ($assignmentRole) {
            'deal_watcher' => __('email.dealWatcherAssigned.subject'),
            'new_deal' => __('email.newDealAwaitingAgent.subject'),
            default => __('email.dealAgentAssigned.subject'),
        };
    }

    private function assignmentText(string $assignmentRole): string
    {
        $dealName = $this->safeMailText($this->deal->name ?? '', 200);

        $base = match ($assignmentRole) {
            'deal_watcher' => __('email.dealWatcherAssigned.text', ['dealName' => $dealName]),
            'new_deal' => __('email.newDealAwaitingAgent.text', ['dealName' => $dealName]),
            default => __('email.dealAgentAssigned.text', ['dealName' => $dealName]),
        };

        // Title + the notification's compact subject line already say "assigned
        // as deal agent" + the deal name, so once an AI summary exists, the
        // detail text is the summary alone — repeating the base sentence there
        // too would just be the same redundant boilerplate again.
        $snippet = $this->aiSummarySnippet($this->deal);

        return $snippet ?: $base;
    }

    private function assignmentAction(string $assignmentRole): string
    {
        return match ($assignmentRole) {
            'deal_watcher' => __('email.dealWatcherAssigned.action'),
            'new_deal' => __('email.newDealAwaitingAgent.action'),
            default => __('email.dealAgentAssigned.action'),
        };
    }

}
