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
        $preheader = $this->assignmentText($role);
        $actionText = $this->assignmentAction($role);

        $leadEmail = __('modules.lead.clientEmail') . ': ';
        $clientEmail = !is_null($this->deal->contact->client_email) ? $leadEmail : '';
        $content = $subject . '<br>' .__('modules.deal.dealName') . ': '  . $this->deal->name . '<br>' .  __('modules.lead.clientName') . ': '  . $this->deal->contact->client_name_salutation . '<br>' . $clientEmail . $this->deal->contact->client_email;

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
            'leadName'       => $this->deal->contact->client_name,
            'leadEmail'      => $this->deal->contact->client_email ?? '',
            'dealName'       => $this->deal->name,
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
            'name' => $this->deal->name,
            'source' => $this->deal->leadSource?->name,
            'agent_id' => $notifiable->id,
            'added_by' => $this->deal->added_by,
            'assignment_role' => $assignmentRole,
            'title' => $this->assignmentTitle($assignmentRole),
            'text' => $this->assignmentText($assignmentRole),
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
        $dealName = $this->deal->name;

        return match ($assignmentRole) {
            'deal_watcher' => __('email.dealWatcherAssigned.text', ['dealName' => $dealName]),
            'new_deal' => __('email.newDealAwaitingAgent.text', ['dealName' => $dealName]),
            default => __('email.dealAgentAssigned.text', ['dealName' => $dealName]),
        };
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
