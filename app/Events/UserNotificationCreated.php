<?php

namespace App\Events;

use App\Support\RealtimeNotifications;
use Illuminate\Broadcasting\InteractsWithBroadcasting;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * A notification row was just created for a user: push it to their open tabs.
 *
 * Broadcast inline (not queued) on purpose: it is raised from inside a queue
 * worker, and a second queue hop would add up to the worker's sleep interval
 * to every popup. The caller (NotificationRealtimePublisher) swallows broadcast
 * failures, so a socket outage can never fail the notification job.
 *
 * Deferred until the surrounding DB transaction commits, so the browser's
 * follow-up reads never race a row that is not visible yet.
 */
final class UserNotificationCreated implements ShouldBroadcastNow, ShouldDispatchAfterCommit
{
    use Dispatchable, InteractsWithBroadcasting;

    /**
     * @param  array<string, mixed>  $notification  Slim payload (NotificationService::formatForRealtime) or {id, truncated}
     */
    public function __construct(
        public int $userId,
        public array $notification,
        public int $unreadCount,
    ) {
        $this->broadcastVia(RealtimeNotifications::connection());
    }

    /** @return array<int, PrivateChannel> */
    public function broadcastOn(): array
    {
        return [new PrivateChannel(RealtimeNotifications::channelFor($this->userId))];
    }

    public function broadcastAs(): string
    {
        return 'notification.created';
    }

    /** @return array<string, mixed> */
    public function broadcastWith(): array
    {
        return [
            'notification' => $this->notification,
            'unread_count' => $this->unreadCount,
        ];
    }
}
