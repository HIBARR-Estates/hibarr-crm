<?php

namespace Modules\Zoom\Listeners;

use Illuminate\Support\Facades\Notification;
use Modules\Zoom\Events\MeetingHostEvent;
use Modules\Zoom\Notifications\InviteHost;

class MeetingHostListener
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
    public function handle(MeetingHostEvent $meeting)
    {

        Notification::send($meeting->notifyUser, new InviteHost($meeting->meeting));

    }
}
