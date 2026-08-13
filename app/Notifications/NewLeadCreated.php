<?php

namespace App\Notifications;

use App\Models\EmailNotificationSetting;
use App\Models\Lead;
use App\Models\Deal;

class NewLeadCreated extends BaseNotification
{

    /**
     * Create a new notification instance.
     *
     * @return void
     */
    private $leadContact;
    private $emailSetting;

    public function __construct(Lead $leadContact)
    {
        $this->leadContact = $leadContact;
        $this->company = $this->leadContact->company;
        $this->emailSetting = EmailNotificationSetting::where('company_id', $this->company->id)->where('slug', 'lead-notification')->first();
        $this->captureTriggeredByUser();
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
        // Never notify the person who created the lead (including admins).
        if ($this->isTriggeredByNotifiable($notifiable)) {
            return [];
        }

        $via = array('database');

        if ($this->emailSetting->send_email == 'yes' && $notifiable->email_notifications && $notifiable->email != '') {
            array_push($via, 'mail');
        }

        if ($this->emailSetting->send_push == 'yes' && push_setting()->beams_push_status == 'active') {
            $pushNotification = new \App\Http\Controllers\DashboardController();
            $pushUsersIds = [[$notifiable->id]];
            $pushNotification->sendPushNotifications(
                $pushUsersIds,
                __('email.lead.subject'),
                $this->safeMailText($this->leadContact->client_name, 200)
            );
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
        $url = route('lead-contact.show', $this->leadContact->id);
        $url = getDomainSpecificUrl($url, $this->company);

        $leadName = $this->safeMailText($this->leadContact->client_name_salutation ?? $this->leadContact->client_name, 200);
        $leadEmail = $this->safeMailText($this->leadContact->client_email ?? '', 320);
        $leadEmailLabel = __('modules.lead.clientEmail') . ': ';
        $clientEmail = $leadEmail !== '' ? $leadEmailLabel . $leadEmail . '<br>' : '';
        $content = __('email.lead.subject') . '<br>' . __('modules.lead.clientName') . ': '  . $leadName . '<br>' . $clientEmail;

        if (session()->has('deal_name')) {
            $content .=  __('modules.deal.dealName') . ": " . $this->safeMailText(session('deal_name'), 200) . '<br>';
        }

        $preheader = $this->safePreheader(__('email.newLead.text'));

        $build
            ->subject(__('email.lead.subject') . ' - ' . config('app.name'))
            ->markdown('mail.email', [
                'url' => $url,
                'content' => $content,
                'preheader' => $preheader,
                'themeColor' => $this->company->header_color,
                'actionText' => __('email.lead.action'),
                'notifiableName' => $notifiable->name
            ]);

        $this->attachPlunkTemplate($build, 'd64189c5-07db-44be-8a6e-f16df5b2a9c0', [
            'preheader'     => $preheader,
            'leadName'      => $this->safeMailText($this->leadContact->client_name, 200),
            'leadEmail'     => $leadEmail,
            'leadOwnerName' => optional($this->leadContact->leadOwner)->name ?? '',
            'sourceName'    => optional($this->leadContact->leadSource)->type ?? '',
            'createdAt'     => $this->leadContact->created_at->format($this->company->date_format),
            'addedByName'   => optional($this->leadContact->addedBy)->name ?? '',
            'leadUrl'       => $url,
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
        return [
            'id' => $this->leadContact->id,
            'name' => $this->safeMailText($this->leadContact->client_name, 200),
            'agent_id' => $notifiable->id,
            'added_by' => $this->leadContact->added_by
        ];
    }

}
