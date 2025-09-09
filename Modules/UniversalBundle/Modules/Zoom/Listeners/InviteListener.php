<?php

namespace Modules\Zoom\Listeners;

use Illuminate\Support\Facades\Notification;
use Modules\Zoom\Events\MeetingInviteEvent;
use Modules\Zoom\Notifications\Invite;

class InviteListener
{
    /**
     * Create the event listener.
     *
     * @return void
     */
    public function __construct()
    {
        //
    }

    /**
     * Handle the event.
     *
     * @param  object  $event
     * @return void
     */
    public function handle(MeetingInviteEvent $meeting)
    {
        Notification::send($meeting->notifyUser, new Invite($meeting->meeting));

    }
}
