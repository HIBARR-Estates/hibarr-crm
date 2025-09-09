<?php

namespace Modules\Sms\Notifications;

use App\Models\SubTask;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\VonageMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Str;
use Modules\Sms\Entities\SmsTemplateId;
use Modules\Sms\Entities\SmsNotificationSetting;
use Modules\Sms\Http\Traits\WhatsappMessageTrait;
use NotificationChannels\Telegram\TelegramMessage;
use NotificationChannels\Twilio\TwilioChannel;
use NotificationChannels\Twilio\TwilioSmsMessage;

class SubTaskAssigneeAdded extends Notification implements ShouldQueue
{
    use Queueable, WhatsappMessageTrait;

    /**
     * Create a new notification instance.
     *
     * @return void
     */
    private $subTask;

    private $message;

    private $smsSetting;

    private $company;

    private $msg_flow_id;

    public function __construct(SubTask $subTask)
    {
        $this->subTask = $subTask;

        $this->company = $this->subTask->task->company;
        $this->smsSetting = SmsNotificationSetting::where('slug', 'sub-task-assignee-added')->where('company_id', $this->company->id)->first();
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

        $this->message = $this->subTask->title.' '.__('email.subTaskAssigneeAdded.subject').'.'."\n".((! is_null($this->subTask->task->project)) ? __('app.project').' - '.$this->subTask->task->project->project_name : '');

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
            __($this->smsSetting->slug->translationString(), ['title' => $this->subTask->title, 'project' => $this->subTask->task->project ? $this->subTask->task->project->project_name : '-']),
            ['1' => $this->subTask->title, '2' => $this->subTask->task->project ? $this->subTask->task->project->project_name : '-']
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
        $mobile = $notifiable->country_phonecode . $notifiable->mobile;
        if ($this->smsSetting->msg91_flow_id && sms_setting()->msg91_status) {
            return (new \Craftsys\Notifications\Messages\Msg91SMS)
                ->to($mobile)
                ->flow($this->msg_flow_id->msg91_flow_id)
                ->variable('title', Str::limit($this->subTask->title, 27, '...'))
                ->variable('project'($this->subTask->task->project ? $this->subTask->task->project->project_name : '-'));
        }
    }

    public function toTelegram($notifiable)
    {
        return TelegramMessage::create()
            // Optional recipient user id.
            ->to($notifiable->telegram_user_id)
            // Markdown supported.
            ->content($this->message)
            ->button(__('email.subTaskAssigneeAdded.action'), route('tasks.show', [$this->subTask->task->id, 'view' => 'sub_task']));
    }
}
