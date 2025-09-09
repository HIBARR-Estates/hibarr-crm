<?php

namespace Modules\Performance\Listeners;

use App\Jobs\SendWhatsappNotification;
use Illuminate\Support\Facades\Notification;
use Modules\Performance\Events\MeetingInviteEvent;
use Modules\Performance\Events\MeetingReminderEvent;
use Modules\Performance\Notifications\MeetingReminderNotification;

class MeetingReminderListener
{

    /**
     * Handle the meeting.
     *
     * @param MeetingInviteEvent $meeting
     * @return void
     */

    public function handle(MeetingReminderEvent $meeting)
    {
        if ($meeting->meetingBy) {
            Notification::send($meeting->meetingBy, new MeetingReminderNotification($meeting->meeting));

            // Send WhatsApp message to user
            if (global_setting()->whatsapp_status == 'active' && (!user()->is_superadmin && checkPackageFeature('whatsapp_messaging')) && (global_setting()->whatsapp_phone_id != null && global_setting()->whatsapp_access_token != null))
            {
                SendWhatsappNotification::dispatch('one_to_one_meeting_reminder', $meeting->meeting, $meeting->meetingBy, $meeting->meeting->company);
            }
        }
    }

}
