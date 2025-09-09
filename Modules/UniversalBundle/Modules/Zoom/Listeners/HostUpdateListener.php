<?php

namespace Modules\Zoom\Listeners;

use Illuminate\Support\Facades\Notification;
use Modules\Zoom\Events\MeetingHostUpdateEvent;
use Modules\Zoom\Notifications\UpdateHost;

class HostUpdateListener
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
    public function handle(MeetingHostUpdateEvent $meeting)
    {

        Notification::send($meeting->notifyUser, new UpdateHost($meeting->meeting));

    }
}
