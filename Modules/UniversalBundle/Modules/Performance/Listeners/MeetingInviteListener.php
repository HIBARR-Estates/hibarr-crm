<?php

namespace Modules\Performance\Listeners;

use Illuminate\Support\Facades\Notification;
use Modules\Performance\Events\MeetingInviteEvent;
use Modules\Performance\Notifications\MeetingInviteNotification;

class MeetingInviteListener
{

    /**
     * Handle the meeting.
     *
     * @param MeetingInviteEvent $meeting
     * @return void
     */

    public function handle(MeetingInviteEvent $meeting)
    {
        if ($meeting->notifyUser) {
            Notification::send($meeting->notifyUser, new MeetingInviteNotification($meeting->meeting));
            Notification::send($meeting->meetingBy, new MeetingInviteNotification($meeting->meeting));
        }
    }

}
