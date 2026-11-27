<?php

namespace Tests\Unit\Notifications;

use App\Events\UserNotificationCreated;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Notifications\Events\NotificationSending;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * The real path, not mocks: a genuine ->notify() through Laravel's notification
 * sender, the real `database` channel and the real NotificationSent event.
 */
class RealtimeNotificationPipelineTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::create('notifications', function (Blueprint $table) {
            $table->char('id', 36)->primary();
            $table->string('type');
            $table->string('notifiable_type');
            $table->unsignedBigInteger('notifiable_id');
            $table->text('data');
            $table->timestamp('read_at')->nullable();
            $table->timestamps();
        });

        config([
            'realtime.notifications.enabled' => true,
            'broadcasting.connections.reverb.key' => 'k',
            'broadcasting.connections.reverb.secret' => 's',
            'broadcasting.connections.reverb.app_id' => '1',
            'broadcasting.connections.reverb.options.host' => '127.0.0.1',
            'broadcasting.connections.reverb.options.port' => 9,
            'broadcasting.connections.reverb.options.scheme' => 'http',
            'broadcasting.connections.reverb.options.useTLS' => false,
            'logging.default' => 'null',
        ]);
    }

    public function test_a_notification_sent_to_a_user_is_pushed_the_moment_its_row_is_created(): void
    {
        Event::fake([UserNotificationCreated::class]);

        $row = $this->notify($this->user(7), ['title' => 'Deal stage updated', 'deal_id' => 42]);

        Event::assertDispatched(UserNotificationCreated::class, function (UserNotificationCreated $event) use ($row) {
            return $event->userId === 7
                // It is the row that was just written, not a copy built from the notification.
                && $event->notification['id'] === $row->id
                && $event->notification['title'] === 'Deal stage updated'
                && $event->notification['data']['deal_id'] === 42
                && $event->unreadCount === 1;
        });
    }

    public function test_every_user_gets_their_own_push_on_a_fan_out(): void
    {
        Event::fake([UserNotificationCreated::class]);

        \Illuminate\Support\Facades\Notification::send(
            [$this->user(7), $this->user(8)],
            $this->notification(['title' => 'Team update']),
        );

        Event::assertDispatchedTimes(UserNotificationCreated::class, 2);
        Event::assertDispatched(UserNotificationCreated::class, fn ($e) => $e->userId === 7);
        Event::assertDispatched(UserNotificationCreated::class, fn ($e) => $e->userId === 8);
    }

    public function test_a_notification_stopped_before_sending_is_never_pushed(): void
    {
        // This is how the per-user bypass (SuppressBypassedNotification) and the other
        // "do not send" rules work: a NotificationSending listener returning false.
        Event::listen(NotificationSending::class, fn () => false);
        Event::fake([UserNotificationCreated::class]);

        $this->user(7)->notify($this->notification(['title' => 'Muted']));

        $this->assertSame(0, DB::table('notifications')->count(), 'no row');
        Event::assertNothingDispatched();
    }

    public function test_channels_other_than_database_do_not_push(): void
    {
        Event::fake([UserNotificationCreated::class]);
        PipelineTestChannel::$sent = 0;

        $this->user(7)->notify(new class extends Notification {
            public function via($notifiable): array
            {
                return [PipelineTestChannel::class];
            }
        });

        $this->assertSame(1, PipelineTestChannel::$sent, 'the other channel really was sent');
        $this->assertSame(0, DB::table('notifications')->count());
        Event::assertNothingDispatched();
    }

    public function test_a_dead_socket_server_never_fails_the_notification(): void
    {
        // Real broadcast to a closed port: the connection is refused. The row must still
        // be written and ->notify() must return normally, or a queue retry would re-send
        // every channel of the notification.
        $this->user(7)->notify($this->notification(['title' => 'Still delivered']));

        $this->assertSame(1, DB::table('notifications')->where('notifiable_id', 7)->count());
    }

    public function test_nothing_is_pushed_while_the_feature_is_off(): void
    {
        config(['realtime.notifications.enabled' => false]);
        Event::fake([UserNotificationCreated::class]);

        $this->notify($this->user(7), ['title' => 'Quiet']);

        Event::assertNothingDispatched();
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function notify(User $user, array $data): object
    {
        $user->notify($this->notification($data));

        return DB::table('notifications')->where('notifiable_id', $user->id)->latest('created_at')->first();
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function notification(array $data): Notification
    {
        return new class($data) extends Notification {
            public function __construct(private array $data)
            {
            }

            public function via($notifiable): array
            {
                return ['database'];
            }

            public function toArray($notifiable): array
            {
                return $this->data;
            }
        };
    }

    private function user(int $id): User
    {
        $user = new User();
        $user->setRawAttributes(['id' => $id, 'company_id' => 1]);

        return $user;
    }
}

/** A non-database channel, to prove only `database` sends are pushed. */
class PipelineTestChannel
{
    public static int $sent = 0;

    public function send($notifiable, Notification $notification): void
    {
        self::$sent++;
    }
}
