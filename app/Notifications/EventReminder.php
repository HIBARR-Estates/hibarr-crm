<?php

namespace App\Notifications;

use App\Models\Event;

class EventReminder extends BaseNotification
{

    private $event;

    /**
     * Create a new notification instance.
     *
     * @return void
     */
    public function __construct(Event $event)
    {
        $this->event = $event;
        $this->company = $this->event->company;
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

        if ($notifiable->email_notifications && $notifiable->email != '') {
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
        $url = route('events.show', $this->event->id);
        $url = getDomainSpecificUrl($url, $this->company);

        // Format date and time for the new template
        // Convert from UTC to company timezone
        $timezone = $this->company->timezone ?? 'UTC';
        $startDateTime = $this->event->start_date_time->copy()->setTimezone($timezone);
        $endDateTime = $this->event->end_date_time->copy()->setTimezone($timezone);
        
        // Format: "Mon Jan 19, 2026 15:00 - 16:00 (Timezone)"
        $dateTime = $startDateTime->format('D M d, Y H:i') . ' - ' . $endDateTime->format('H:i') . ' (' . $timezone . ')';

        // Only include meeting link if it exists and is not empty
        $meetingLink = !empty($this->event->event_link) ? $this->event->event_link : null;

        $build
            ->subject(__('email.eventReminder.subject') . ' - ' . config('app.name'))
            ->view('mail.event.reminder', [
                'eventName' => $this->event->event_name,
                'dateTime' => $dateTime,
                'meetingLink' => $meetingLink,
                'viewEventUrl' => $url,
                'notifiableName' => $notifiable->name
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
        return $this->event->toArray();
    }

}
