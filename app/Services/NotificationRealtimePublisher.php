<?php

namespace App\Services;

use App\Events\UserNotificationCreated;
use App\Events\UserNotificationsRead;
use App\Models\User;
use App\Support\RealtimeNotifications;
use Illuminate\Notifications\DatabaseNotification;
use Throwable;

/**
 * Turns "a notification row exists / stopped being unread" into realtime events.
 *
 * Every method is best-effort and never throws: it runs inside a queued notification
 * job (or an HTTP request), and a failed broadcast must not fail the job — a retry
 * would re-send every channel of that notification and duplicate the rows, emails
 * and Slack messages. The row in the database is the source of truth; whatever the
 * socket misses is recovered by the browser through the catch-up endpoint.
 */
class NotificationRealtimePublisher
{
    /** More ids than this are not listed; the browser re-fetches instead. */
    private const MAX_READ_IDS = 100;

    public function __construct(private readonly NotificationService $notifications)
    {
    }

    public function created(User $user, DatabaseNotification $row): void
    {
        if (! RealtimeNotifications::enabled()) {
            return;
        }

        try {
            $payload = $this->withUserLocale(
                $user,
                fn () => $this->notifications->formatForRealtime($row),
            );

            event(new UserNotificationCreated(
                (int) $user->id,
                $this->fitPayload($payload, $row),
                $this->notifications->getUnreadCount($user),
            ));
        } catch (Throwable $e) {
            report($e);
        }
    }

    /**
     * @param  array<int, string>  $ids
     */
    public function read(User $user, array $ids, bool $all = false): void
    {
        if (! RealtimeNotifications::enabled()) {
            return;
        }

        try {
            $refresh = ! $all && count($ids) > self::MAX_READ_IDS;

            event(new UserNotificationsRead(
                (int) $user->id,
                $all || $refresh ? [] : array_values(array_map('strval', $ids)),
                $all,
                $this->notifications->getUnreadCount($user),
                $refresh,
            ));
        } catch (Throwable $e) {
            report($e);
        }
    }

    /**
     * Over the size limit the message degrades to the id alone; the browser then
     * fetches the content through the catch-up endpoint.
     *
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    private function fitPayload(array $payload, DatabaseNotification $row): array
    {
        $max = (int) config('realtime.notifications.max_payload_bytes', 8000);

        if (strlen((string) json_encode($payload)) <= $max) {
            return $payload;
        }

        return [
            'id' => (string) $row->id,
            'created_at' => $row->created_at?->toIso8601String(),
            'truncated' => true,
        ];
    }

    /**
     * Titles/text go through __(), and a queue worker runs in the default locale,
     * so format in the recipient's — the same text their bell shows.
     */
    private function withUserLocale(User $user, callable $callback): mixed
    {
        $previous = app()->getLocale();
        $locale = (string) ($user->locale ?? '');

        if ($locale !== '' && preg_match('/^[A-Za-z_-]+$/', $locale) && is_dir(resource_path('lang/'.$locale))) {
            app()->setLocale($locale);
        }

        try {
            return $callback();
        } finally {
            app()->setLocale($previous);
        }
    }
}
