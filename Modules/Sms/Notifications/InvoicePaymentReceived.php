<?php

namespace Modules\Sms\Notifications;

use App\Models\Invoice;
use App\Models\Payment;
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

class InvoicePaymentReceived extends Notification implements ShouldQueue
{
    use Queueable, WhatsappMessageTrait;

    /**
     * Create a new notification instance.
     *
     * @return void
     */
    private $payment;

    private $company;

    private $smsSetting;

    private $invoice;

    private $message;

    private $msg_flow_id;

    public function __construct(Payment $payment)
    {
        $this->payment = $payment;
        $this->company = $this->payment->company;
        $this->smsSetting = SmsNotificationSetting::where('slug', 'payment-received')->where('company_id', $this->company->id)->first();
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

        $this->invoice = Invoice::find($this->payment->invoice_id);

        $number = $this->invoice->invoice_number;
        $message = __('email.invoices.paymentReceivedForInvoice');

        if ($this->invoice->order_id != null) {
            $number = __('app.order').'#'.$this->invoice->order_id;
            $message = __('email.invoices.paymentReceivedForOrder');
        }

        $this->message = __('email.invoices.paymentReceived')."\n".$message."\n".$number;

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
        $paymentType = __('app.invoice');
        $number = $this->invoice->invoice_number;

        if ($this->invoice->order_id != null) {
            $paymentType = __('app.order');
            $number = __('app.order').'#'.$this->invoice->order_id;
        }

        $this->toWhatsapp(
            $this->smsSetting->slug,
            $notifiable,
            __($this->smsSetting->slug->translationString(), ['paymentType' => $paymentType, 'number' => $number]),
            ['1' => $paymentType, '2' => $number]
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
        $paymentType = __('app.invoice');
        $number = $this->invoice->invoice_number;

        if ($this->invoice->order_id != null) {
            $paymentType = __('app.order');
            $number = __('app.order').'#'.$this->invoice->order_id;
        }
        $mobile = $notifiable->country_phonecode . $notifiable->mobile;
        if ($this->smsSetting->msg91_flow_id && sms_setting()->msg91_status) {
            return (new \Craftsys\Notifications\Messages\Msg91SMS)
                ->to($mobile)
                ->flow($this->msg_flow_id->msg91_flow_id)
                ->variable('payment_type', $paymentType)
                ->variable('number', $number);
        }
    }

    public function toTelegram($notifiable)
    {
        $url = route('invoices.show', $this->invoice->id);
        $actionBtn = __('email.invoices.action');

        if ($this->invoice->order_id != null) {
            $url = route('orders.show', $this->invoice->order_id);
            $actionBtn = __('email.orders.action');
        }

        return TelegramMessage::create()
            // Optional recipient user id.
            ->to($notifiable->telegram_user_id)
            // Markdown supported.
            ->content($this->message)
            ->button($actionBtn, $url);
    }
}
