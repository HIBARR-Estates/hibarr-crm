<?php

namespace App\Listeners;

use App\Models\User;
use App\Services\NotificationRealtimePublisher;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Notifications\Events\NotificationSent;

/**
 * The one hook that makes every notification realtime: whenever Laravel finishes
 * sending a notification over the `database` channel (≈ every ->notify() call and
 * every scheduled reminder), push the row that was just created to its recipient.
 *
 * Nothing here changes a notification's own via()/channels. Bypassed notifications
 * (SuppressBypassedNotification) and "don't notify the actor" rules stop the send
 * before a row exists, so they never reach this listener.
 */
class BroadcastDatabaseNotification
{
    public function __construct(private readonly NotificationRealtimePublisher $publisher)
    {
    }

    public function handle(NotificationSent $event): void
    {
        if ($event->channel !== 'database') {
            return;
        }

        if (! $event->notifiable instanceof User || ! $event->response instanceof DatabaseNotification) {
            return;
        }

        $this->publisher->created($event->notifiable, $event->response);
    }
}
