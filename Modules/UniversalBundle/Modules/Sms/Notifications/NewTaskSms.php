<?php

namespace Modules\Sms\Notifications;

use App\Models\Task;
use Illuminate\Support\Str;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;
use Illuminate\Contracts\Queue\ShouldQueue;
use Modules\Sms\Entities\SmsTemplateId;
use NotificationChannels\Twilio\TwilioChannel;
use Modules\Sms\Entities\SmsNotificationSetting;
use Modules\Sms\Http\Traits\WhatsappMessageTrait;
use NotificationChannels\Twilio\TwilioSmsMessage;
use NotificationChannels\Telegram\TelegramMessage;
use Illuminate\Notifications\Messages\VonageMessage;

class NewTaskSms extends Notification implements ShouldQueue
{

    use Queueable, WhatsappMessageTrait;

    /**
     * Create a new notification instance.
     *
     * @return void
     */
    private $task;
    private $smsSetting;
    private $message;
    private $company;

    private $msg_flow_id;

    public function __construct(Task $task)
    {
        $this->task = $task;

        $this->company = $this->task->company;
        $this->smsSetting = SmsNotificationSetting::where('slug', 'new-task')->where('company_id', $this->company->id)->first();
        $this->msg_flow_id = SmsTemplateId::where('sms_setting_slug', 'new-task')->first();
    }

    /**
     * Get the notification's delivery channels.
     *
     * @param mixed $notifiable
     * @return array
     */
    public function via($notifiable)
    {
        if ($this->smsSetting && $this->smsSetting->send_sms != 'yes') {
            return array();
        }

        $dueDate = $this->task->due_date ? __('app.dueDate') . ': ' . $this->task->due_date->format($this->task->company->date_format) : '';

        $this->message = __('email.newTask.subject') . "\n" . $this->task->heading . "\n" . __('app.task') . ' #' . $this->task->task_short_code . "\n" . $dueDate;

        $via = array();

        if (!is_null($notifiable->mobile) && !is_null($notifiable->country_phonecode)) {
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
            __($this->smsSetting->slug->translationString(), ['heading' => $this->task->heading, 'taskId' => $this->task->id, 'dueDate' => $this->task->due_date->format($this->task->company->date_format)]),
            ['1' => $this->task->heading, '2' => $this->task->id, '3' => $this->task->due_date->format($this->task->company->date_format)]
        );

        if (sms_setting()->status) {
            return (new TwilioSmsMessage())
                ->content($this->message);
        }
    }

    //phpcs:ignore
    public function toVonage($notifiable)
    {
        if (sms_setting()->nexmo_status) {
            return (new VonageMessage())
                ->content($this->message);
        }
    }

    //phpcs:ignore
    public function toMsg91($notifiable)
    {
        $mobile = $notifiable->country_phonecode . $notifiable->mobile;
        if (sms_setting()->msg91_status) {
            return (new \Craftsys\Notifications\Messages\Msg91SMS)
                ->to($mobile)
                ->flow($this->msg_flow_id->msg91_flow_id)
                ->variable('heading', Str::limit($this->task->heading, 27, '...'))
                ->variable('task_id', $this->task->id)
                ->variable('due_date', $this->task->due_date->format($this->task->company->date_format));
        }
    }

    public function toTelegram($notifiable)
    {
        return TelegramMessage::create()
            // Optional recipient user id.
            ->to($notifiable->telegram_user_id)
            // Markdown supported.
            ->content($this->message)
            ->button(__('app.view'), route('tasks.show', $this->task->id));
    }

}
