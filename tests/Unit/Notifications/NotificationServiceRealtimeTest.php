<?php

namespace Tests\Unit\Notifications;

use App\Events\UserNotificationsRead;
use App\Models\User;
use App\Services\NotificationService;
use Carbon\Carbon;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class NotificationServiceRealtimeTest extends TestCase
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
    }

    // ── payload ────────────────────────────────────────────────────────────

    public function test_the_realtime_payload_keeps_only_what_the_popup_reads(): void
    {
        $this->insert('n1', 7, '2026-11-19 10:00:00', data: [
            'deal_name' => 'Villa Marmaris',
            'deal_id' => 42,
            'text' => 'Stage moved',
            'internal_note' => 'secret commission details',
            'nested' => ['a' => 1],
            'item_name' => str_repeat('x', 400),
        ]);

        $payload = $this->service()->formatForRealtime(DatabaseNotification::find('n1'));

        $this->assertSame('n1', $payload['id']);
        $this->assertSame('Villa Marmaris', $payload['data']['deal_name']);
        $this->assertSame(42, $payload['data']['deal_id']);
        $this->assertArrayNotHasKey('internal_note', $payload['data']);
        $this->assertArrayNotHasKey('nested', $payload['data']);
        $this->assertSame(301, mb_strlen($payload['data']['item_name']), 'long values are cut to 300 + ellipsis');
        $this->assertArrayHasKey('created_at', $payload);
        $this->assertArrayHasKey('icon', $payload);
    }

    // ── catch-up ───────────────────────────────────────────────────────────

    public function test_without_a_cursor_only_server_time_comes_back_so_history_is_never_replayed(): void
    {
        $this->insert('n1', 7, '2026-11-19 10:00:00');

        $result = $this->service()->getUnreadSince($this->user(7), null);

        $this->assertSame([], $result['notifications']);
        $this->assertFalse($result['has_more']);
        $this->assertSame($result['server_time'], $result['next_cursor']);
    }

    public function test_it_returns_this_users_unread_notifications_since_the_cursor_oldest_first(): void
    {
        $this->insert('old', 7, '2026-11-19 09:00:00');
        $this->insert('b', 7, '2026-11-19 10:00:30');
        $this->insert('a', 7, '2026-11-19 10:00:10');
        $this->insert('read', 7, '2026-11-19 10:00:20', read: true);
        $this->insert('someone-else', 8, '2026-11-19 10:00:15');

        $result = $this->service()->getUnreadSince($this->user(7), $this->iso('2026-11-19 10:00:00'));

        $this->assertSame(['a', 'b'], array_column($result['notifications'], 'id'));
        $this->assertFalse($result['has_more']);
        $this->assertSame($this->iso('2026-11-19 10:00:30'), Carbon::parse($result['next_cursor'])->setTimezone('UTC')->toIso8601String());
    }

    public function test_the_window_overlaps_the_cursor_so_a_same_second_row_is_not_skipped(): void
    {
        // Same second as the cursor, random uuid: a plain "newer than" would drop it.
        $this->insert('same-second', 7, '2026-11-19 10:00:00');
        $this->insert('3s-before', 7, '2026-11-19 09:59:57');
        $this->insert('10s-before', 7, '2026-11-19 09:59:50');

        $result = $this->service()->getUnreadSince($this->user(7), $this->iso('2026-11-19 10:00:00'));

        $this->assertSame(['3s-before', 'same-second'], array_column($result['notifications'], 'id'));
    }

    public function test_a_long_backlog_is_paged_and_says_so(): void
    {
        $this->insert('a', 7, '2026-11-19 10:00:01');
        $this->insert('b', 7, '2026-11-19 10:00:02');
        $this->insert('c', 7, '2026-11-19 10:00:03');

        $result = $this->service()->getUnreadSince($this->user(7), $this->iso('2026-11-19 10:00:00'), limit: 2);

        $this->assertSame(['a', 'b'], array_column($result['notifications'], 'id'));
        $this->assertTrue($result['has_more']);
        $this->assertSame($this->iso('2026-11-19 10:00:02'), Carbon::parse($result['next_cursor'])->setTimezone('UTC')->toIso8601String());
    }

    public function test_a_cursor_in_another_timezone_means_the_same_instant(): void
    {
        $this->insert('a', 7, '2026-11-19 10:00:05');

        $cursor = Carbon::parse('2026-11-19 10:00:00', 'UTC')->setTimezone('Asia/Tashkent')->toIso8601String();
        $result = $this->service()->getUnreadSince($this->user(7), $cursor);

        $this->assertSame(['a'], array_column($result['notifications'], 'id'));
    }

    // ── read events ────────────────────────────────────────────────────────

    public function test_marking_one_read_tells_the_other_tabs(): void
    {
        $this->enableRealtime();
        Event::fake([UserNotificationsRead::class]);
        $this->insert('a', 7, '2026-11-19 10:00:01');
        $this->insert('b', 7, '2026-11-19 10:00:02');

        $this->assertTrue($this->service()->markAsRead($this->user(7), 'a'));

        Event::assertDispatched(UserNotificationsRead::class, fn (UserNotificationsRead $e) => $e->userId === 7
            && $e->ids === ['a']
            && ! $e->all
            && $e->unreadCount === 1);
    }

    public function test_marking_unknown_ids_read_says_nothing(): void
    {
        $this->enableRealtime();
        Event::fake([UserNotificationsRead::class]);

        $this->assertFalse($this->service()->markAsRead($this->user(7), 'missing'));

        Event::assertNothingDispatched();
    }

    public function test_marking_all_read_says_all(): void
    {
        $this->enableRealtime();
        Event::fake([UserNotificationsRead::class]);
        $this->insert('a', 7, '2026-11-19 10:00:01');

        $this->service()->markAllAsRead($this->user(7));

        Event::assertDispatched(UserNotificationsRead::class, fn (UserNotificationsRead $e) => $e->all && $e->unreadCount === 0);
    }

    public function test_marking_several_read_lists_only_those_that_were_unread(): void
    {
        $this->enableRealtime();
        Event::fake([UserNotificationsRead::class]);
        $this->insert('a', 7, '2026-11-19 10:00:01');
        $this->insert('already', 7, '2026-11-19 10:00:02', read: true);

        $this->service()->markMultipleAsRead($this->user(7), ['a', 'already']);

        Event::assertDispatched(UserNotificationsRead::class, fn (UserNotificationsRead $e) => $e->ids === ['a']);
    }

    public function test_deleting_a_notification_removes_it_from_other_tabs_too(): void
    {
        $this->enableRealtime();
        Event::fake([UserNotificationsRead::class]);
        $this->insert('a', 7, '2026-11-19 10:00:01');

        $this->assertTrue($this->service()->delete($this->user(7), 'a'));
        $this->assertSame(0, $this->service()->deleteMultiple($this->user(7), ['gone']));

        Event::assertDispatchedTimes(UserNotificationsRead::class, 1);
    }

    public function test_nothing_is_published_while_the_feature_is_off(): void
    {
        Event::fake([UserNotificationsRead::class]);
        $this->insert('a', 7, '2026-11-19 10:00:01');

        $this->service()->markAsRead($this->user(7), 'a');
        $this->service()->markAllAsRead($this->user(7));

        Event::assertNothingDispatched();
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    private function service(): NotificationService
    {
        return new NotificationService();
    }

    private function user(int $id): User
    {
        $user = new User();
        $user->setRawAttributes(['id' => $id, 'company_id' => 1]);

        return $user;
    }

    private function enableRealtime(): void
    {
        config([
            'realtime.notifications.enabled' => true,
            'broadcasting.connections.reverb.key' => 'k',
            'broadcasting.connections.reverb.secret' => 's',
            'broadcasting.connections.reverb.app_id' => '1',
            'broadcasting.connections.reverb.options.host' => '127.0.0.1',
        ]);
    }

    /** A UTC wall-clock string as an ISO cursor. */
    private function iso(string $utc): string
    {
        return Carbon::parse($utc, 'UTC')->toIso8601String();
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function insert(string $id, int $userId, string $createdAtUtc, bool $read = false, array $data = []): void
    {
        $createdAt = Carbon::parse($createdAtUtc, 'UTC')->setTimezone(config('app.timezone'))->toDateTimeString();

        DB::table('notifications')->insert([
            'id' => $id,
            'type' => 'App\\Notifications\\SomethingHappened',
            'notifiable_type' => (new User())->getMorphClass(),
            'notifiable_id' => $userId,
            'data' => json_encode($data + ['text' => 'Something happened']),
            'read_at' => $read ? $createdAt : null,
            'created_at' => $createdAt,
            'updated_at' => $createdAt,
        ]);
    }
}
