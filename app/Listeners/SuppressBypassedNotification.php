<?php

namespace App\Listeners;

use App\Support\NotificationBypass;
use Illuminate\Notifications\Events\NotificationSending;

class SuppressBypassedNotification
{
    /**
     * Return false to skip this channel; null lets sending continue.
     */
    public function handle(NotificationSending $event): ?bool
    {
        if (NotificationBypass::shouldSuppress($event->notifiable, $event->notification)) {
            return false;
        }

        return null;
    }
}
