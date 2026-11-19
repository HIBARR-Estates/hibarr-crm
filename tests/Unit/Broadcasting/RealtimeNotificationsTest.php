<?php

namespace Tests\Unit\Broadcasting;

use App\Events\UserNotificationCreated;
use App\Events\UserNotificationsRead;
use App\Http\Controllers\RealtimeAuthController;
use App\Listeners\BroadcastDatabaseNotification;
use App\Models\User;
use App\Services\NotificationRealtimePublisher;
use App\Services\NotificationService;
use App\Support\RealtimeNotifications;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Http\Request;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Notifications\Events\NotificationSent;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\Event;
use Illuminate\Validation\ValidationException;
use Mockery;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

class RealtimeNotificationsTest extends TestCase
{
    // ── events ──────────────────────────────────────────────────────────────

    public function test_created_event_goes_only_to_the_recipients_private_channel_on_the_realtime_connection(): void
    {
        $event = new UserNotificationCreated(7, ['id' => 'abc', 'title' => 'Hi'], 4);

        $this->assertEquals([new PrivateChannel('notifications.7')], $event->broadcastOn());
        $this->assertSame('notification.created', $event->broadcastAs());
        $this->assertSame(['notification' => ['id' => 'abc', 'title' => 'Hi'], 'unread_count' => 4], $event->broadcastWith());
        // Pinned: it must never fall through to the legacy default (hosted Pusher) connection.
        $this->assertSame(['reverb'], $event->broadcastConnections());
    }

    public function test_read_event_carries_ids_and_the_new_unread_count(): void
    {
        $event = new UserNotificationsRead(7, ['a', 'b'], false, 2);

        $this->assertEquals([new PrivateChannel('notifications.7')], $event->broadcastOn());
        $this->assertSame('notification.read', $event->broadcastAs());
        $this->assertSame(['ids' => ['a', 'b'], 'all' => false, 'refresh' => false, 'unread_count' => 2], $event->broadcastWith());
        $this->assertSame(['reverb'], $event->broadcastConnections());
    }

    public function test_the_connection_can_be_repointed_from_config(): void
    {
        config(['realtime.notifications.connection' => 'elsewhere']);

        $this->assertSame(['elsewhere'], (new UserNotificationCreated(1, [], 0))->broadcastConnections());
    }

    // ── configuration ──────────────────────────────────────────────────────

    public function test_it_is_off_by_default(): void
    {
        $this->assertFalse(RealtimeNotifications::enabled());
        $this->assertNull(RealtimeNotifications::clientConfig());
    }

    public function test_it_is_on_only_when_the_switch_and_a_complete_connection_are_set(): void
    {
        $this->enableRealtime();
        $this->assertTrue(RealtimeNotifications::enabled());

        foreach (['key', 'secret', 'app_id', 'options.host'] as $missing) {
            $this->enableRealtime();
            config(['broadcasting.connections.reverb.'.$missing => null]);
            $this->assertFalse(RealtimeNotifications::enabled(), "must be off without {$missing}");
        }

        $this->enableRealtime();
        config(['realtime.notifications.enabled' => false]);
        $this->assertFalse(RealtimeNotifications::enabled(), 'kill switch');
    }

    public function test_the_browser_config_has_public_values_only(): void
    {
        $this->enableRealtime();

        $client = RealtimeNotifications::clientConfig();

        $this->assertSame('test-key', $client['key']);
        $this->assertSame('ws.example.test', $client['host']);
        $this->assertSame(443, $client['port']);
        $this->assertSame('https', $client['scheme']);
        $this->assertStringEndsWith('/realtime/auth', $client['authEndpoint']);

        $json = json_encode($client);
        $this->assertStringNotContainsString('test-secret', $json);
        $this->assertArrayNotHasKey('secret', $client);
        $this->assertArrayNotHasKey('app_id', $client);
    }

    public function test_no_browser_config_without_a_public_key_or_host(): void
    {
        $this->enableRealtime();
        config(['realtime.client.host' => null]);

        $this->assertNull(RealtimeNotifications::clientConfig());
    }

    // ── channel authorization ──────────────────────────────────────────────

    public function test_a_user_is_signed_into_their_own_notification_channel_with_the_realtime_secret(): void
    {
        $this->enableRealtime();

        $response = (new RealtimeAuthController())->authorizeChannel(
            $this->authRequest($this->user(7), 'private-notifications.7'),
        );

        $this->assertSame(
            ['auth' => 'test-key:'.hash_hmac('sha256', '1234.5678:private-notifications.7', 'test-secret')],
            $response->getData(true),
        );
    }

    public function test_a_user_cannot_listen_to_someone_elses_notifications_or_any_other_channel(): void
    {
        $this->enableRealtime();

        foreach (['private-notifications.8', 'private-messages.7', 'notifications.7', 'private-notifications.7.extra'] as $channel) {
            try {
                (new RealtimeAuthController())->authorizeChannel($this->authRequest($this->user(7), $channel));
                $this->fail("{$channel} must be refused");
            } catch (HttpException $e) {
                $this->assertSame(403, $e->getStatusCode(), $channel);
            }
        }
    }

    public function test_guests_and_a_disabled_feature_get_nothing_signed(): void
    {
        $this->enableRealtime();

        $this->assertForbidden(fn () => (new RealtimeAuthController())->authorizeChannel(
            $this->authRequest(null, 'private-notifications.7'),
        ));

        config(['realtime.notifications.enabled' => false]);

        $this->assertForbidden(fn () => (new RealtimeAuthController())->authorizeChannel(
            $this->authRequest($this->user(7), 'private-notifications.7'),
        ));
    }

    public function test_a_malformed_socket_id_is_rejected(): void
    {
        $this->enableRealtime();

        $this->expectException(ValidationException::class);

        (new RealtimeAuthController())->authorizeChannel(
            $this->authRequest($this->user(7), 'private-notifications.7', socketId: 'not-a-socket-id'),
        );
    }

    // ── listener ────────────────────────────────────────────────────────────

    public function test_only_database_sends_to_a_user_are_forwarded(): void
    {
        $row = new DatabaseNotification();
        $user = $this->user(7);

        $publisher = Mockery::mock(NotificationRealtimePublisher::class);
        $publisher->shouldReceive('created')->once()->with($user, $row);

        $listener = new BroadcastDatabaseNotification($publisher);

        $listener->handle($this->sent($user, 'database', $row));
        $listener->handle($this->sent($user, 'mail', $row));
        $listener->handle($this->sent($user, 'database', 'not a row'));
        $listener->handle($this->sent(new \stdClass(), 'database', $row));
    }

    // ── publisher ───────────────────────────────────────────────────────────

    public function test_nothing_is_broadcast_while_the_feature_is_off(): void
    {
        Event::fake([UserNotificationCreated::class, UserNotificationsRead::class]);

        $publisher = $this->publisher();
        $publisher->created($this->user(7), $this->row('n1'));
        $publisher->read($this->user(7), ['n1']);

        Event::assertNothingDispatched();
    }

    public function test_a_created_notification_is_pushed_with_the_users_unread_count(): void
    {
        $this->enableRealtime();
        Event::fake([UserNotificationCreated::class]);

        $this->publisher(unread: 3)->created($this->user(7), $this->row('n1'));

        Event::assertDispatched(UserNotificationCreated::class, function (UserNotificationCreated $event) {
            return $event->userId === 7
                && $event->unreadCount === 3
                && $event->notification['id'] === 'n1'
                && ! isset($event->notification['truncated']);
        });
    }

    public function test_an_oversized_message_degrades_to_the_id_alone(): void
    {
        $this->enableRealtime();
        config(['realtime.notifications.max_payload_bytes' => 200]);
        Event::fake([UserNotificationCreated::class]);

        $this->publisher(payload: ['id' => 'n1', 'text' => str_repeat('x', 500)])
            ->created($this->user(7), $this->row('n1'));

        Event::assertDispatched(UserNotificationCreated::class, function (UserNotificationCreated $event) {
            return $event->notification === [
                'id' => 'n1',
                'created_at' => '2026-11-19T10:00:00+00:00',
                'truncated' => true,
            ];
        });
    }

    public function test_the_message_is_formatted_in_the_recipients_language_and_the_locale_is_restored(): void
    {
        $this->enableRealtime();
        Event::fake([UserNotificationCreated::class]);
        $before = app()->getLocale();

        $seen = null;
        $user = $this->user(7);
        $user->setRawAttributes(['id' => 7, 'locale' => 'de']);

        $this->publisher(onFormat: function () use (&$seen) {
            $seen = app()->getLocale();
        })->created($user, $this->row('n1'));

        $this->assertSame('de', $seen);
        $this->assertSame($before, app()->getLocale());
    }

    public function test_an_unknown_locale_leaves_the_application_locale_alone(): void
    {
        $this->enableRealtime();
        Event::fake([UserNotificationCreated::class]);

        $seen = null;
        $user = $this->user(7);
        $user->setRawAttributes(['id' => 7, 'locale' => '../../etc']);

        $this->publisher(onFormat: function () use (&$seen) {
            $seen = app()->getLocale();
        })->created($user, $this->row('n1'));

        $this->assertSame(app()->getLocale(), $seen);
    }

    public function test_a_broadcast_failure_never_escapes(): void
    {
        // A real broadcast to a closed port: the connection is refused immediately.
        $this->enableRealtime();
        config(['logging.default' => 'null']);

        $publisher = $this->publisher();
        $publisher->created($this->user(7), $this->row('n1'));
        $publisher->read($this->user(7), ['n1']);

        $this->addToAssertionCount(1); // reaching here is the assertion: nothing was thrown
    }

    public function test_read_events_list_ids_or_flag_all_or_ask_for_a_refresh(): void
    {
        $this->enableRealtime();
        Event::fake([UserNotificationsRead::class]);
        $publisher = $this->publisher(unread: 1);

        $publisher->read($this->user(7), ['a', 'b']);
        $publisher->read($this->user(7), [], all: true);
        $publisher->read($this->user(7), array_map(fn ($i) => "id-{$i}", range(1, 101)));

        $events = Event::dispatched(UserNotificationsRead::class)->map(fn ($args) => $args[0])->values();

        $this->assertSame(['a', 'b'], $events[0]->ids);
        $this->assertFalse($events[0]->all);

        $this->assertTrue($events[1]->all);
        $this->assertSame([], $events[1]->ids);

        $this->assertTrue($events[2]->refresh);
        $this->assertSame([], $events[2]->ids);
        $this->assertSame(1, $events[2]->unreadCount);
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    private function enableRealtime(): void
    {
        config([
            'realtime.notifications.enabled' => true,
            'realtime.client.key' => 'test-key',
            'realtime.client.host' => 'ws.example.test',
            'realtime.client.port' => 443,
            'realtime.client.scheme' => 'https',
            'broadcasting.connections.reverb.key' => 'test-key',
            'broadcasting.connections.reverb.secret' => 'test-secret',
            'broadcasting.connections.reverb.app_id' => '1',
            'broadcasting.connections.reverb.options.host' => '127.0.0.1',
            'broadcasting.connections.reverb.options.port' => 9,
            'broadcasting.connections.reverb.options.scheme' => 'http',
            'broadcasting.connections.reverb.options.useTLS' => false,
        ]);
    }

    private function user(int $id): User
    {
        $user = new User();
        $user->setRawAttributes(['id' => $id, 'company_id' => 1]);

        return $user;
    }

    private function row(string $id): DatabaseNotification
    {
        $row = new DatabaseNotification();
        $row->setRawAttributes(['id' => $id, 'created_at' => '2026-11-19 10:00:00']);

        return $row;
    }

    private function sent(object $notifiable, string $channel, mixed $response): NotificationSent
    {
        return new NotificationSent($notifiable, new class extends Notification {
        }, $channel, $response);
    }

    private function authRequest(?User $user, string $channel, string $socketId = '1234.5678'): Request
    {
        $request = Request::create('/account/realtime/auth', 'POST', [
            'socket_id' => $socketId,
            'channel_name' => $channel,
        ]);
        $request->setUserResolver(fn () => $user);

        return $request;
    }

    private function assertForbidden(callable $call): void
    {
        try {
            $call();
            $this->fail('expected a 403');
        } catch (HttpException $e) {
            $this->assertSame(403, $e->getStatusCode());
        }
    }

    /**
     * @param  array<string, mixed>|null  $payload
     */
    private function publisher(int $unread = 0, ?array $payload = null, ?callable $onFormat = null): NotificationRealtimePublisher
    {
        $service = new class($unread, $payload, $onFormat) extends NotificationService {
            public function __construct(private int $unread, private ?array $payload, private $onFormat)
            {
            }

            public function getUnreadCount(User $user): int
            {
                return $this->unread;
            }

            public function formatForRealtime(DatabaseNotification $notification): array
            {
                if ($this->onFormat) {
                    ($this->onFormat)();
                }

                return $this->payload ?? ['id' => $notification->id, 'title' => 'Title', 'text' => 'Text'];
            }
        };

        return new NotificationRealtimePublisher($service);
    }
}
