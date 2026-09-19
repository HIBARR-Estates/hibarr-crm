<?php

namespace App\Events;

use App\Models\UserChat;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class NewMessage implements ShouldBroadcastNow
{

    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $userChat;

    /**
     * Create a new event instance.
     *
     * @return void
     */
    public function __construct(UserChat $userChat)
    {
        $this->userChat = $userChat;
    }

    /**
     * The conversation's own private channel, which only its two participants
     * can join (routes/channels.php). This used to be a single "chat" channel
     * that every logged-in user of every company could subscribe to.
     *
     * @return \Illuminate\Broadcasting\Channel|array
     */
    public function broadcastOn()
    {
        return new PrivateChannel(self::conversationChannel(
            $this->userChat->from ?? $this->userChat->user_one,
            $this->userChat->to ?? $this->userChat->user_id
        ));
    }

    public function broadcastWith(): array
    {
        return [
            'id' => $this->userChat->id,
            'from' => $this->userChat->from,
            'to' => $this->userChat->to,
        ];
    }

    /**
     * One channel per pair of users, lowest id first: chat.{low}.{high}.
     * The messages page builds the same name for typing whispers.
     */
    public static function conversationChannel(int|string|null $userA, int|string|null $userB): string
    {
        $ids = [(int) $userA, (int) $userB];
        sort($ids);

        return 'chat.' . $ids[0] . '.' . $ids[1];
    }

}
