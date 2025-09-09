<?php

namespace Modules\Sms\Notifications;

use App\Models\Event;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\VonageMessage;
use Illuminate\Notifications\Notification;
use Modules\Sms\Entities\SmsNotificationSetting;
use Modules\Sms\Http\Traits\WhatsappMessageTrait;
use NotificationChannels\Telegram\TelegramMessage;
use NotificationChannels\Twilio\TwilioChannel;
use NotificationChannels\Twilio\TwilioSmsMessage;
use Modules\Sms\Entities\SmsTemplateId;

class EventInviteSms extends Notification implements ShouldQueue
{
    use Queueable, WhatsappMessageTrait;

    /**
     * Create a new notification instance.
     *
     * @return void
     */
    private $event;

    private $company;

    private $smsSetting;

    private $message;
    private $msg_flow_id;

    public function __construct(Event $event)
    {
        $this->event = $event;

        $this->company = $this->event->company;
        $this->smsSetting = SmsNotificationSetting::where('slug', 'event-invite')->where('company_id', $this->company->id)->first();
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

        $this->message = __('email.newEvent.subject')."\n".__('modules.events.eventName').': '.$this->event->event_name."\n".__('modules.events.startOn').': '.$this->event->start_date_time->format($this->company->date_format.' - '.$this->company->time_format)."\n".__('modules.events.endOn').': '.$this->event->end_date_time->format($this->company->date_format.' - '.$this->company->time_format)."\n".__('app.venue').': '.$this->event->where;

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
            __($this->smsSetting->slug->translationString(), ['eventName' => $this->event->event_name, 'eventStartDate' => $this->event->start_date_time->format($this->company->date_format.' - '.$this->company->time_format), 'eventEndDate' => $this->event->end_date_time->format($this->company->date_format.' - '.$this->company->time_format), 'eventLocation' => $this->event->where]),
            ['1' => $this->event->event_name, '2' => $this->event->start_date_time->format($this->company->date_format.' - '.$this->company->time_format), '3' => $this->event->end_date_time->format($this->company->date_format.' - '.$this->company->time_format), '4' => $this->event->where]
        );

        if ($this->smsSetting->status) {
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
        $mobile = $notifiable->country_phonecode . $notifiable->mobile;
        if ($this->smsSetting->msg91_flow_id && sms_setting()->msg91_status) {
            return (new \Craftsys\Notifications\Messages\Msg91SMS)
                ->to($mobile)
                ->flow($this->msg_flow_id->msg91_flow_id)
                ->variable('event_name', $this->event->event_name)
                ->variable('event_start_date', $this->event->start_date_time->format($this->company->date_format.' - '.$this->company->time_format))
                ->variable('event_end_date', $this->event->end_date_time->format($this->company->date_format.' - '.$this->company->time_format))
                ->variable('event_location', $this->event->where);
        }
    }

    public function toTelegram($notifiable)
    {
        return TelegramMessage::create()
            // Optional recipient user id.
            ->to($notifiable->telegram_user_id)
            // Markdown supported.
            ->content($this->message)
            ->button(__('email.newEvent.action'), route('events.show', $this->event->id));
    }
}
