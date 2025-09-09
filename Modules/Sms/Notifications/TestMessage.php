<?php

namespace Modules\Sms\Notifications;

use App\Scopes\CompanyScope;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\VonageMessage;
use Illuminate\Notifications\Notification;
use Modules\Sms\Entities\SmsNotificationSetting;
use NotificationChannels\Telegram\TelegramMessage;
use Modules\Sms\Entities\SmsTemplateId;
use NotificationChannels\Twilio\TwilioChannel;
use NotificationChannels\Twilio\TwilioSmsMessage;

class TestMessage extends Notification implements ShouldQueue
{
    use Queueable;

    private $smsTemplateId;
    private $smsSetting;
    private $msg_flow_id;

    private $request;

    /**
     * Create a new notification instance.
     *
     * @return void
     */
    public function __construct($request = null)
    {
        $this->request = $request;
        $this->smsSetting = SmsNotificationSetting::withoutGlobalScope(CompanyScope::class)->where('slug', 'test-sms-notification')->first();
        $this->smsTemplateId = SmsTemplateId::where('sms_setting_slug', $this->smsSetting->slug)->first();
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

        $via = [];

        if (sms_setting()->status) {
            $number = $this->request['phone_code'].$this->request['mobile'];
            $notifiable->phone_number = $number;
            array_push($via, TwilioChannel::class);
        }

        if (sms_setting()->nexmo_status) {
            $number = str_replace('+', '', $this->request['phone_code']).$this->request['mobile'];
            $notifiable->phone_number = $number;

            array_push($via, 'vonage');
        }

        if (sms_setting()->msg91_status) {
            $number = str_replace('+', '', $this->request['phone_code']).$this->request['mobile'];
            $notifiable->phone_number = $number;
            array_push($via, 'msg91');
        }

        if (sms_setting()->telegram_status && $notifiable->telegram_user_id) {
            array_push($via, 'telegram');
        }

        return $via;
    }

    //phpcs:ignore
    public function toTwilio($notifiable)
    {
        $settings = sms_setting();
        $message = 'This is twilio test message';

        if ($settings->whatsapp_status && $this->smsTemplateId->whatsapp_template_sid) {
            $toNumber = request()->phone_code.request()->mobile;
            $fromNumber = $settings->whatapp_from_number;
            $twilio = new \Twilio\Rest\Client($settings->account_sid, $settings->auth_token);
            $twilio->messages
                ->create(
                    'whatsapp:'.$toNumber, // to
                    [
                        'from' => 'whatsapp:'.$fromNumber,
                        'body' => __($this->smsSetting->slug->translationString(), ['gateway' => 'whatsapp']),
                        'contentSid' => $this->smsTemplateId->whatsapp_template_sid,
                    ]
                );
        }

        if ($settings->status) {
            return (new TwilioSmsMessage)
                ->content($message);
        }
    }

    //phpcs:ignore
    public function toVonage(object $notifiable)
    {
        $message = 'This is vonage test message';

        return (new VonageMessage)
            ->content($message)->unicode();
    }

    //phpcs:ignore
    public function toMsg91($notifiable)
    {
        $mobile = $notifiable->country_phonecode . $notifiable->mobile;
        if ($this->smsSetting->msg91_flow_id && sms_setting()->msg91_status) {
            return (new \Craftsys\Notifications\Messages\Msg91SMS)
                ->to($mobile)
                ->flow($this->msg_flow_id->msg91_flow_id);
        }
    }

    public function toTelegram($notifiable)
    {
        $message = 'This is a telegram test message.';

        return TelegramMessage::create()
            // Optional recipient user id.
            ->to($this->request['telegram_user_id'] ?? $notifiable->telegram_user_id)
            // Markdown supported.
            ->content($message);
    }

}
