<?php

namespace Modules\Sms\Notifications;

use App\Models\DealFollowUp;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\VonageMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Str;
use Modules\Sms\Entities\SmsNotificationSetting;
use Modules\Sms\Http\Traits\WhatsappMessageTrait;
use NotificationChannels\Telegram\TelegramMessage;
use NotificationChannels\Twilio\TwilioChannel;
use NotificationChannels\Twilio\TwilioSmsMessage;
use Modules\Sms\Entities\SmsTemplateId;

class AutoFollowUpReminder extends Notification implements ShouldQueue
{
    use Queueable, WhatsappMessageTrait;

    private $followUpDate;
    private $leadFollowup;

    private $message;

    private $smsSetting;
    private $msg_flow_id;

    /**
     * Create a new notification instance.
     *
     * @return void
     */
    public function __construct(DealFollowUp $leadFollowup)
    {
        $this->leadFollowup = $leadFollowup;
        $company = $this->leadFollowup->lead->company;
        $this->followUpDate = $leadFollowup?->next_follow_up_date?->format($company->date_format);
        $this->smsSetting = SmsNotificationSetting::where('slug', 'follow-up-reminder')->where('company_id', $company->id)->first();
        $this->msg_flow_id = SmsTemplateId::where('sms_setting_slug', 'new-task')->first();

    }

    /**
     * Get the notification's delivery channels.
     *
     * @param  mixed  $notifiable
     * @return array
     */
    public function via($notifiable)
    {
        if ($this->smsSetting && $this->smsSetting->send_sms != 'yes') {
            return [];
        }

        $this->message = __('email.followUpReminder.subject').' #'.$this->leadFollowup->id.' - '.config('app.name').'.'.'\n'.__('email.followUpReminder.nextFollowUpDate').' :- '.$this->followUpDate.'\n'.$this->leadFollowup->remark;

        $via = [];

        if (! is_null($notifiable->mobile) && ! is_null($notifiable->country_phonecode)) {
            if (sms_setting()->status) {
                array_push($via, TwilioChannel::class);
            }

            if (sms_setting()->nexmo_status) {
                array_push($via, 'vonage');
            }

            if (sms_setting()->msg91_status) {
                array_push($via, 'msg91');
            }
        }

        if (sms_setting()->telegram_status && $notifiable->telegram_user_id) {
            array_push($via, 'telegram');
        }

        return $via;
    }

    public function toTwilio($notifiable)
    {

        $this->toWhatsapp(
            $this->smsSetting->slug,
            $notifiable,
            __($this->smsSetting->slug->translationString(), ['leadId' => $this->leadFollowup->lead_id, 'followUpDate' => $this->followUpDate, 'remark' => $this->leadFollowup->remark]),
            ['1' => $this->leadFollowup->lead_id, '2' => $this->followUpDate, '3' => $this->leadFollowup->remark]
        );

        if (sms_setting()->status) {
            return (new TwilioSmsMessage)
                ->content($this->message);
        }
    }

    //phpcs:ignore
    public function toVonage($notifiable)
    {

        if (sms_setting()->nexmo_status) {
            return (new VonageMessage)
                ->content($this->message)->unicode();
        }
    }

    //phpcs:ignore
    public function toMsg91($notifiable)
    {
        $remark = Str::limit($this->leadFollowup->remark, 27, '...');
        $mobile = $notifiable->country_phonecode . $notifiable->mobile;
        if ($this->smsSetting->msg91_flow_id && sms_setting()->msg91_status) {
            return (new \Craftsys\Notifications\Messages\Msg91SMS)
                ->to($mobile)
                ->flow($this->msg_flow_id->msg91_flow_id)
                ->variable('lead_id', $this->leadFollowup->lead->id)
                ->variable('follow_up_date', $this->followUpDate)
                ->variable('remark', $remark);
        }
    }

    public function toTelegram($notifiable)
    {

        return TelegramMessage::create()
            // Optional recipient user id.
            ->to($notifiable->telegram_user_id)
            // Markdown supported.
            ->content($this->message)
            ->button(__('email.followUpReminder.action'), route('leads.show', $this->leadFollowup->lead_id).'?tab=follow-up');
    }

}
