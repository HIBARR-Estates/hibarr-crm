<?php

namespace App\Services\CallBridge;

use Illuminate\Contracts\Cache\LockTimeoutException;
use Illuminate\Support\Facades\Cache;

/**
 * The one shared position of an inbound call in its ring rotation.
 *
 * Every agent's browser receives the call and asks who should ring. If each
 * browser stepped through the rotation on its own timer, a browser that
 * joined late (page opened mid-ring, slow lookup) would still be on the first
 * agent while the others had moved on, and an agent pausing mid-call would
 * shift everyone's position. Instead the order is frozen when the call is
 * first seen and the position advances here, against the server clock.
 */
class InboundCallRotation
{
    /** Long enough for the longest rotation; the state is useless after the call. */
    public const TTL_SECONDS = 900;

    public static function cacheKey(int $companyId, string $callKey): string
    {
        return sprintf('softphone:call_rotation:%d:%s', $companyId, $callKey);
    }

    /**
     * Resolve the rotation for a call as of now.
     *
     * A slot ends when its agent passed the call, stopped being available, or
     * rang for `$slotSeconds` without answering. `index` equal to the number
     * of users means the rotation is exhausted (final fallback window).
     *
     * @param  array<int, array{id: int, name: string, role: string, priority?: int}>  $sequence  Order to freeze on first sight.
     * @param  array<int, int>  $passedUserIds
     * @return array{users: array<int, array{id: int, name: string, role: string, priority?: int}>, index: int, slot_remaining_seconds: int}
     */
    public static function resolve(int $companyId, string $callKey, array $sequence, array $passedUserIds, int $slotSeconds): array
    {
        $key = self::cacheKey($companyId, $callKey);
        $slotSeconds = max(1, $slotSeconds);

        $advance = function () use ($key, $sequence, $passedUserIds, $slotSeconds): array {
            $now = microtime(true);
            $state = Cache::get($key);
            if (! is_array($state) || ! isset($state['users'], $state['index'], $state['slot_started_at'])) {
                $state = ['users' => array_values($sequence), 'index' => 0, 'slot_started_at' => $now];
            }

            $users = $state['users'];
            $index = (int) $state['index'];
            $slotStartedAt = (float) $state['slot_started_at'];
            $availableIds = array_map(fn (array $user): int => (int) $user['id'], $sequence);

            while ($index < count($users)) {
                $userId = (int) $users[$index]['id'];

                if (in_array($userId, $passedUserIds, true) || ! in_array($userId, $availableIds, true)) {
                    $index++;
                    $slotStartedAt = $now;

                    continue;
                }

                if ($now - $slotStartedAt >= $slotSeconds) {
                    // Keep the cadence exact rather than restarting at "now".
                    $index++;
                    $slotStartedAt += $slotSeconds;

                    continue;
                }

                break;
            }

            Cache::put($key, [
                'users' => $users,
                'index' => $index,
                'slot_started_at' => $slotStartedAt,
            ], self::TTL_SECONDS);

            return [
                'users' => $users,
                'index' => $index,
                'slot_remaining_seconds' => (int) max(0, ceil($slotSeconds - ($now - $slotStartedAt))),
            ];
        };

        try {
            return Cache::lock($key.':lock', 5)->block(2, $advance);
        } catch (LockTimeoutException) {
            return $advance();
        }
    }

    public static function forget(int $companyId, string $callKey): void
    {
        Cache::forget(self::cacheKey($companyId, $callKey));
    }
}
