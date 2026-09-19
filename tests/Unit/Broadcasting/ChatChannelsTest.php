<?php

namespace Tests\Unit\Broadcasting;

use App\Events\NewChatEvent;
use App\Events\NewMentionChatEvent;
use App\Events\NewMessage;
use App\Models\User;
use App\Models\UserChat;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ChatChannelsTest extends TestCase
{
    public function test_new_chat_signal_goes_only_to_the_recipient_without_content(): void
    {
        $event = new NewChatEvent($this->chat(from: 3, to: 7));

        $this->assertEquals([new PrivateChannel('messages.7')], $event->broadcastOn());
        $this->assertArrayNotHasKey('message', $event->broadcastWith());
    }

    public function test_mention_signal_goes_to_recipient_and_mentioned_users(): void
    {
        $mentioned = collect([$this->user(5), $this->user(7)]);
        $event = new NewMentionChatEvent($this->chat(from: 3, to: 7), $mentioned);

        $names = collect($event->broadcastOn())->map(fn (PrivateChannel $channel) => $channel->name)->sort()->values()->all();

        $this->assertSame(['private-messages.5', 'private-messages.7'], $names);
    }

    public function test_conversation_channel_is_the_same_for_both_participants(): void
    {
        $this->assertSame('chat.3.7', NewMessage::conversationChannel(7, 3));
        $this->assertSame('chat.3.7', NewMessage::conversationChannel('3', '7'));
        $this->assertEquals(new PrivateChannel('chat.3.7'), (new NewMessage($this->chat(from: 7, to: 3)))->broadcastOn());
    }

    public function test_messages_channel_is_only_for_its_owner(): void
    {
        $authorize = $this->channelCallback('messages.{userId}');

        $this->assertTrue($authorize($this->user(5), '5'));
        $this->assertFalse($authorize($this->user(6), '5'));
    }

    public function test_conversation_channel_needs_a_participant_from_the_same_company(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
        });
        DB::table('users')->insert([
            ['id' => 3, 'company_id' => 1],
            ['id' => 7, 'company_id' => 1],
            ['id' => 9, 'company_id' => 2],
        ]);

        $authorize = $this->channelCallback('chat.{userOne}.{userTwo}');

        $this->assertTrue($authorize($this->user(3, companyId: 1), '3', '7'));
        $this->assertFalse($authorize($this->user(5, companyId: 1), '3', '7'), 'not a participant');
        $this->assertFalse($authorize($this->user(3, companyId: 1), '3', '9'), 'other participant in another company');
    }

    private function channelCallback(string $pattern): callable
    {
        $callback = Broadcast::driver()->getChannels()->get($pattern);
        $this->assertIsCallable($callback, "channel {$pattern} is not registered");

        return $callback;
    }

    private function chat(int $from, int $to): UserChat
    {
        $chat = new UserChat();
        $chat->setRawAttributes(['id' => 11, 'user_one' => $from, 'user_id' => $to, 'from' => $from, 'to' => $to, 'message' => 'secret']);

        return $chat;
    }

    private function user(int $id, int $companyId = 1): User
    {
        $user = new User();
        $user->setRawAttributes(['id' => $id, 'company_id' => $companyId]);

        return $user;
    }
}
