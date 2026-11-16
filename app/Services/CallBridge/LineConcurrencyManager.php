<?php

namespace App\Services\CallBridge;

use App\Models\SoftphoneDevice;
use App\Support\SipProviderRegistry;
use Illuminate\Contracts\Cache\LockTimeoutException;
use Illuminate\Support\Facades\Cache;

/**
 * Tracks how many calls are live on a phone line (softphone device) so the
 * CRM never asks the SIP platform for more than `max_concurrent_calls`.
 *
 * A slot belongs to the agent on the call, not to a call id: a browser holds
 * one live call at a time, and the ids a call is reported under differ
 * between events (SIP Call-ID while ringing, the dock's own reference on a
 * failure). Keying on the agent means a slot is always freed by its holder
 * and a lost "ended" report heals itself on that agent's next call.
 */
class LineConcurrencyManager
{
    /** A slot older than this is treated as orphaned (tab closed mid-call). */
    public const STALE_CALL_SECONDS = 7200;

    public const CACHE_TTL_SECONDS = 86400;

    public static function cacheKey(int $deviceId): string
    {
        return sprintf('softphone:line_active_calls:%d', $deviceId);
    }

    public static function maxConcurrentCalls(SoftphoneDevice $device): int
    {
        return (int) ($device->max_concurrent_calls
            ?? SipProviderRegistry::defaultMaxConcurrentCalls($device->provider));
    }

    /**
     * Take a slot on the line for this agent. Returns false when the line is
     * full; `$force` records a call that is already live (an answered inbound
     * call) regardless of the limit.
     */
    public static function reserve(SoftphoneDevice $device, int $userId, bool $force = false): bool
    {
        if ($device->is_active === false) {
            return false;
        }

        $max = self::maxConcurrentCalls($device);

        return self::mutate((int) $device->id, function (array $slots) use ($userId, $max, $force): array {
            $others = $slots;
            unset($others[$userId]);

            if (! $force && count($others) >= $max) {
                return [$slots, false];
            }

            $slots[$userId] = now()->timestamp;

            return [$slots, true];
        });
    }

    /** Free this agent's slot on the line. A no-op when they hold none. */
    public static function release(int $deviceId, int $userId): void
    {
        self::mutate($deviceId, function (array $slots) use ($userId): array {
            unset($slots[$userId]);

            return [$slots, true];
        });
    }

    public static function activeCallsCount(int $deviceId, ?int $exceptUserId = null): int
    {
        $slots = self::slots($deviceId);
        if ($exceptUserId !== null) {
            unset($slots[$exceptUserId]);
        }

        return count($slots);
    }

    /** Whether the line can carry one more call. */
    public static function hasCapacity(SoftphoneDevice $device, ?int $exceptUserId = null): bool
    {
        return $device->is_active !== false
            && self::activeCallsCount((int) $device->id, $exceptUserId) < self::maxConcurrentCalls($device);
    }

    /**
     * @return array{device_id: int, max_concurrent_calls: int, active_calls_count: int, available: bool}
     */
    public static function capacityInfo(SoftphoneDevice $device, ?int $exceptUserId = null): array
    {
        return [
            'device_id' => (int) $device->id,
            'max_concurrent_calls' => self::maxConcurrentCalls($device),
            'active_calls_count' => self::activeCallsCount((int) $device->id, $exceptUserId),
            'available' => self::hasCapacity($device, $exceptUserId),
        ];
    }

    public static function clearDevice(int $deviceId): void
    {
        Cache::forget(self::cacheKey($deviceId));
    }

    /**
     * Live slots on a line as [userId => startedAt], orphaned ones dropped.
     *
     * @return array<int, int>
     */
    private static function slots(int $deviceId): array
    {
        $stored = Cache::get(self::cacheKey($deviceId), []);
        if (! is_array($stored)) {
            return [];
        }

        $threshold = now()->timestamp - self::STALE_CALL_SECONDS;
        $slots = [];
        foreach ($stored as $userId => $startedAt) {
            if (is_numeric($userId) && is_numeric($startedAt) && (int) $startedAt >= $threshold) {
                $slots[(int) $userId] = (int) $startedAt;
            }
        }

        return $slots;
    }

    /**
     * Read-modify-write the line's slots under a lock so two agents dialling
     * at once cannot both take the last slot.
     *
     * @param  callable(array<int, int>): array{0: array<int, int>, 1: bool}  $change
     */
    private static function mutate(int $deviceId, callable $change): bool
    {
        $key = self::cacheKey($deviceId);
        $apply = function () use ($key, $deviceId, $change): bool {
            [$slots, $result] = $change(self::slots($deviceId));
            Cache::put($key, $slots, self::CACHE_TTL_SECONDS);

            return $result;
        };

        try {
            return Cache::lock($key.':lock', 5)->block(2, $apply);
        } catch (LockTimeoutException) {
            // Never fail a call over a busy lock; an unguarded write is the
            // lesser problem.
            return $apply();
        }
    }
}
