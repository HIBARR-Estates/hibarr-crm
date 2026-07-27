<?php

namespace App\Notifications;

use App\Models\MeetingSummary;
use App\Models\DealFollowUp;
use App\Models\Deal;
use App\Models\User;
use App\Support\UserTimezone;
use Illuminate\Notifications\Messages\MailMessage;

class MeetingSummaryNotification extends BaseNotification
{
    protected MeetingSummary $meetingSummary;
    protected DealFollowUp $dealFollowUp;
    protected Deal $deal;
    protected string $action;

    /**
     * Create a new notification instance.
     */
    public function __construct(MeetingSummary $meetingSummary, DealFollowUp $dealFollowUp, Deal $deal, string $action)
    {
        $this->meetingSummary = $meetingSummary;
        $this->dealFollowUp = $dealFollowUp;
        $this->deal = $deal;
        $this->action = $action;
        $this->company = $deal->company;
    }

    /**
     * Get the notification's delivery channels.
     *
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    /**
     * Get the mail representation of the notification.
     */
    public function toMail(object $notifiable): MailMessage
    {
        $subject = $this->action === 'created'
            ? 'New Meeting Summary Available'
            : 'Meeting Summary Updated';

        $summaryLink = $this->modifyUrl(route('meeting-summary.show', $this->meetingSummary->id));

        $mailMessage = parent::build($notifiable)
            ->subject($subject)
            ->greeting('Hello ' . $notifiable->name . '!')
            ->line($this->action === 'created'
                ? 'A new meeting summary has been created for the following deal:'
                : 'A meeting summary has been updated for the following deal:')
            ->line('**Deal:** ' . $this->deal->name);

        // Safely format meeting date in the recipient's timezone
        if ($this->dealFollowUp->next_follow_up_date) {
            $timezone = UserTimezone::resolve(
                $notifiable instanceof User ? $notifiable : null,
                $this->company
            );
            $meetingDate = $this->dealFollowUp->next_follow_up_date
                ->copy()
                ->setTimezone($timezone)
                ->format('M d, Y H:i');
            $mailMessage->line('**Meeting Date:** ' . $meetingDate);
        } else {
            $mailMessage->line('**Meeting Date:** Not specified');
        }

        // Safely format platform
        if ($this->dealFollowUp->location) {
            $mailMessage->line('**Platform:** ' . ucfirst($this->dealFollowUp->location));
        } else {
            $mailMessage->line('**Platform:** Not specified');
        }

        parent::resetLocale();

        return $mailMessage
            ->line('Click the button below to view the meeting summary:')
            ->action('View Meeting Summary', $summaryLink)
            ->line('Thank you for using our CRM system!');
    }

    /**
     * Get the array representation of the notification.
     *
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'meeting_summary_id' => $this->meetingSummary->id,
            'deal_id' => $this->deal->id,
            'deal_name' => $this->deal->name,
            'action' => $this->action,
        ];
    }
}
