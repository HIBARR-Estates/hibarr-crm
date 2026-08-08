<?php

namespace App\Notifications;

use App\Models\EmailNotificationSetting;
use Illuminate\Support\Facades\Session;

class LeadImported extends BaseNotification
{
    private $emailSetting;

    /** @var array<string, mixed> */
    private array $importStats;

    public function __construct(array $importStats = [])
    {
        $this->importStats = $importStats;
        $this->emailSetting = EmailNotificationSetting::where('company_id', company()->id)->where('slug', 'lead-notification')->first();
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

        if ($this->emailSetting->send_email == 'yes' && $notifiable->email_notifications && $notifiable->email != '') {
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

        $leads = Session::get('leads', []);

        $content = __('email.leads.subject') . '<br>';

        $counter = 0;
        foreach ($leads as $lead) {
            $counter++;

            if (!empty($lead['lead_name'])) {
                $content .= __('modules.lead.clientName') . ": " . nl2br($lead['lead_name']) . "<br>";
            }

            if (!empty($lead['email'])) {
                $content .= __('modules.lead.clientEmail') . ": " . $lead['email'] . "<br>";
            }

            if (!empty($lead['deal_name'])) {
                $content .= __('modules.deal.dealName') . ": " . nl2br($lead['deal_name']) . "<br>";
            }

            if ($counter >= 10) {
                break;
            }
        }

        $content .= "<br>";

        if (count($leads) > 10) {
            $url = route('lead-contact.index');
            $build
                ->subject(__('email.leads.subject') . ' - ' . config('app.name'))
                ->markdown('mail.email', [
                    'url' => $url,
                    'content' => $content,
                    'preheader' => __('email.leads.subject'),
                    'themeColor' => company()->header_color,
                    'actionText' => __('email.leadAgent.viewMore'),
                    'notifiableName' => $notifiable->name
                ]);
        } else {
            $build
                ->subject(__('email.leads.subject') . ' - ' . config('app.name'))
                ->markdown('mail.email', [
                    'content' => $content,
                    'preheader' => __('email.leads.subject'),
                    'themeColor' => company()->header_color,
                    'notifiableName' => $notifiable->name
                ]);
        }
        $importUrl = getDomainSpecificUrl(route('lead-contact.index'), null);
        $importCount = (int) ($this->importStats['importCount'] ?? 0);
        $this->attachPlunkTemplate($build, 'c5b022f4-988b-49d1-8a28-bfcdf26cb0bd', [
            'preheader'      => __('email.leads.subject').' ('.$importCount.')',
            'importedByName' => $this->importStats['importedByName'] ?? '',
            'importCount'    => $importCount,
            'failedCount'    => $this->importStats['failedCount'] ?? 0,
            'sourceName'     => $this->importStats['sourceName'] ?? 'CSV Import',
            'importedAt'     => $this->importStats['importedAt'] ?? '',
            'importUrl'      => $importUrl,
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
        $leads = Session::get('leads', []);

        return [
            'leads' => $leads
        ];
    }
}
