<?php

namespace Modules\Zoom\Listeners;

use Illuminate\Support\Facades\Notification;
use Modules\Zoom\Events\MeetingUpdateEvent;
use Modules\Zoom\Notifications\UpdateHost;

class MeetingUpdateListener
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
    public function handle(MeetingUpdateEvent $meeting)
    {

        Notification::send($meeting->notifyUser, new UpdateHost($meeting->meeting));
    }
}
