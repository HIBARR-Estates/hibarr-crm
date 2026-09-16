<?php

namespace App\Events;

use App\Models\UserChat;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class NewMentionChatEvent implements ShouldBroadcast
{

    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $userChat;
    public $notifyUser;

    public function __construct(UserChat $userChat, $notifyUser)
    {
        $this->userChat = $userChat;
        $this->notifyUser = $notifyUser;

    }

    /**
     * The recipient's and each mentioned user's private channel, as in
     * NewChatEvent (previously the public "messages-channel").
     */
    public function broadcastOn()
    {
        return collect($this->notifyUser)
            ->pluck('id')
            ->push($this->userChat->user_id)
            ->filter()
            ->unique()
            ->map(fn ($userId) => new PrivateChannel('messages.' . $userId))
            ->values()
            ->all();
    }

    public function broadcastAs()
    {
        return 'messages.received';
    }

    public function broadcastWith(): array
    {
        return ['id' => $this->userChat->id, 'from' => $this->userChat->from];
    }

}
