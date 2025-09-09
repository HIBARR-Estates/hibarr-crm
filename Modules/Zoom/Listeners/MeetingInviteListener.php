<?php

namespace Modules\Zoom\Listeners;

use Illuminate\Support\Facades\Notification;
use Modules\Zoom\Events\CompanyUrlEvent;
use Modules\Zoom\Notifications\MeetingInvite;

class MeetingInviteListener
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
    public function handle(CompanyUrlEvent $meeting)
    {
        Notification::send($meeting->notifyUser, new MeetingInvite($meeting->meeting));
    }
}
