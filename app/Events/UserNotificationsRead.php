<?php

namespace App\Events;

use App\Support\RealtimeNotifications;
use Illuminate\Broadcasting\InteractsWithBroadcasting;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Notifications stopped being unread for a user (marked read or deleted):
 * their other tabs/devices dismiss any popup and fix the badge.
 *
 * Idempotent on the client, so it is also delivered to the tab that caused it.
 */
final class UserNotificationsRead implements ShouldBroadcastNow, ShouldDispatchAfterCommit
{
    use Dispatchable, InteractsWithBroadcasting;

    /**
     * @param  array<int, string>  $ids  Notification ids; empty when $all or $refresh is set
     * @param  bool  $all  Every unread notification was marked read
     * @param  bool  $refresh  Too many ids to list: the browser should re-fetch its unread summary
     */
    public function __construct(
        public int $userId,
        public array $ids,
        public bool $all,
        public int $unreadCount,
        public bool $refresh = false,
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
        return 'notification.read';
    }

    /** @return array<string, mixed> */
    public function broadcastWith(): array
    {
        return [
            'ids' => $this->ids,
            'all' => $this->all,
            'refresh' => $this->refresh,
            'unread_count' => $this->unreadCount,
        ];
    }
}
