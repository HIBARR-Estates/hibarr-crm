<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\DB;

class UserNotificationAlertSetting extends Model
{
    public const DEFAULT_POSITION = 'top-center';

    public const DEFAULT_DURATION_MS = 4200;

    public const VALID_POSITIONS = [
        'top-left',
        'top-center',
        'top-right',
        'bottom-left',
        'bottom-center',
        'bottom-right',
    ];

    public const VALID_DURATIONS_MS = [3000, 4200, 6000];

    protected $fillable = [
        'user_id',
        'notch_position',
        'notch_duration_ms',
        'alerts_muted',
    ];

    protected $casts = [
        'notch_duration_ms' => 'integer',
        'alerts_muted' => 'boolean',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return array{notch_position: string, notch_duration_ms: int, alerts_muted: bool}
     */
    public static function defaults(): array
    {
        return [
            'notch_position' => self::DEFAULT_POSITION,
            'notch_duration_ms' => self::DEFAULT_DURATION_MS,
            'alerts_muted' => false,
        ];
    }

    /**
     * @return array{notch_position: string, notch_duration_ms: int, alerts_muted: bool}
     */
    public static function forUser(int $userId): array
    {
        $setting = self::query()->where('user_id', $userId)->first();

        if (! $setting) {
            return self::defaults();
        }

        $position = in_array($setting->notch_position, self::VALID_POSITIONS, true)
            ? $setting->notch_position
            : self::DEFAULT_POSITION;

        $duration = in_array($setting->notch_duration_ms, self::VALID_DURATIONS_MS, true)
            ? $setting->notch_duration_ms
            : self::DEFAULT_DURATION_MS;

        return [
            'notch_position' => $position,
            'notch_duration_ms' => $duration,
            'alerts_muted' => (bool) $setting->alerts_muted,
        ];
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array{notch_position: string, notch_duration_ms: int, alerts_muted: bool}
     */
    public static function upsertForUser(int $userId, array $payload): array
    {
        return DB::transaction(function () use ($userId, $payload) {
            self::query()->firstOrCreate(
                ['user_id' => $userId],
                array_merge(['user_id' => $userId], self::defaults()),
            );

            $setting = self::query()
                ->where('user_id', $userId)
                ->lockForUpdate()
                ->firstOrFail();

            $current = [
                'notch_position' => in_array($setting->notch_position, self::VALID_POSITIONS, true)
                    ? $setting->notch_position
                    : self::DEFAULT_POSITION,
                'notch_duration_ms' => in_array($setting->notch_duration_ms, self::VALID_DURATIONS_MS, true)
                    ? $setting->notch_duration_ms
                    : self::DEFAULT_DURATION_MS,
                'alerts_muted' => (bool) $setting->alerts_muted,
            ];

            if (array_key_exists('notch_position', $payload)) {
                $position = (string) $payload['notch_position'];
                $current['notch_position'] = in_array($position, self::VALID_POSITIONS, true)
                    ? $position
                    : self::DEFAULT_POSITION;
            }

            if (array_key_exists('notch_duration_ms', $payload)) {
                $duration = (int) $payload['notch_duration_ms'];
                $current['notch_duration_ms'] = in_array($duration, self::VALID_DURATIONS_MS, true)
                    ? $duration
                    : self::DEFAULT_DURATION_MS;
            }

            if (array_key_exists('alerts_muted', $payload)) {
                $current['alerts_muted'] = (bool) $payload['alerts_muted'];
            }

            $setting->fill([
                'notch_position' => $current['notch_position'],
                'notch_duration_ms' => $current['notch_duration_ms'],
                'alerts_muted' => $current['alerts_muted'],
            ])->save();

            return $current;
        });
    }
}
