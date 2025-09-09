<?php

namespace Modules\Performance\Listeners;

use Modules\Performance\Events\ObjectiveCreatedEvent;
use Illuminate\Support\Facades\Notification;
use Modules\Performance\Notifications\NotifyAssigneeForObjective;

class ObjectiveCreatedListener
{

    /**
     * Handle the event.
     */
    public function handle(ObjectiveCreatedEvent $event)
    {
        Notification::send($event->owners, new NotifyAssigneeForObjective($event->objective));
    }

}
