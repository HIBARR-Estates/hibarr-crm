<?php

namespace Modules\Biolinks\Listeners;

use Illuminate\Support\Facades\Notification;
use Modules\Biolinks\Events\PhoneCollectionEmailEvent;
use Modules\Biolinks\Notifications\PhoneCollectionEmail;

class PhoneCollectionEmailListener
{

    /**
     * Handle the event.
     *
     * @return void
     */
    public function handle(PhoneCollectionEmailEvent $event)
    {
        Notification::send($event->biolinkBlock, new PhoneCollectionEmail($event->name, $event->phone));
    }

}
