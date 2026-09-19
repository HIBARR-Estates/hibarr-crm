<?php

namespace App\Events;

use App\Models\UserChat;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class NewChatEvent implements ShouldBroadcast
{

    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $userChat;

    public function __construct(UserChat $userChat)
    {
        $this->userChat = $userChat;
    }

    /**
     * Only the recipient's private channel (authorized in routes/channels.php).
     * This used to go out on the public "messages-channel", where anyone holding
     * the Pusher app key could read every tenant's chat messages.
     */
    public function broadcastOn()
    {
        return [new PrivateChannel('messages.' . $this->userChat->user_id)];
    }

    public function broadcastAs()
    {
        return 'messages.received';
    }

    /**
     * The messages page only refetches on this signal, so no message content.
     */
    public function broadcastWith(): array
    {
        return ['id' => $this->userChat->id, 'from' => $this->userChat->from];
    }

}
