<?php

namespace App\Support;

use App\Models\Company;
use App\Models\Task;
use App\Models\User;
use Illuminate\Support\Carbon;

/**
 * Task due/start dates are stored as naive wall-clock datetimes (see
 * TaskController@store). Filters and UI buckets must use the same "now"
 * and calendar-day boundaries as {@see UserTimezone::forViewer()}, not
 * raw {@see now()} in the app default timezone.
 */
class TaskWallClock
{
    public static function timezone(?User $user = null, ?Company $company = null): string
    {
        $user ??= function_exists('user') ? user() : null;
        $company ??= function_exists('company') ? company() : null;
        $company = is_object($company) ? $company : null;

        return UserTimezone::forViewer($user, $company);
    }

    /** Current instant expressed in the viewer/company wall-clock basis. */
    public static function now(?User $user = null, ?Company $company = null): Carbon
    {
        return now()->setTimezone(self::timezone($user, $company));
    }

    public static function todayDateString(?User $user = null, ?Company $company = null): string
    {
        return self::now($user, $company)->toDateString();
    }

    public static function nowDateTimeString(?User $user = null, ?Company $company = null): string
    {
        return self::now($user, $company)->format('Y-m-d H:i:s');
    }

    public static function wallClockNowString(?User $user = null, ?Company $company = null): string
    {
        return Task::wallClockString(self::now($user, $company));
    }

    /**
     * Inclusive calendar-day bounds for YYYY-MM-DD filter params.
     *
     * @param  array{0: string, 1: string}  $range
     * @return array{0: string, 1: string}
     */
    public static function dayBounds(array $range, ?User $user = null, ?Company $company = null): array
    {
        $tz = self::timezone($user, $company);

        return [
            Carbon::parse($range[0], $tz)->startOfDay()->format('Y-m-d H:i:s'),
            Carbon::parse($range[1], $tz)->endOfDay()->format('Y-m-d H:i:s'),
        ];
    }

    /**
     * Calendar-day bounds for true UTC instants (`created_at`, `updated_at`).
     * Same viewer calendar days as {@see dayBounds()}, but converted to UTC
     * for columns that are not task wall-clock datetimes.
     *
     * @param  array{0: string, 1: string}  $range
     * @return array{0: string, 1: string}
     */
    public static function utcInstantDayBounds(
        array $range,
        ?User $user = null,
        ?Company $company = null,
    ): array {
        $tz = self::timezone($user, $company);

        return [
            Carbon::parse($range[0], $tz)->startOfDay()->utc()->format('Y-m-d H:i:s'),
            Carbon::parse($range[1], $tz)->endOfDay()->utc()->format('Y-m-d H:i:s'),
        ];
    }

    public static function isDueOnViewerToday(?Carbon $dueDate, ?User $user = null, ?Company $company = null): bool
    {
        if ($dueDate === null) {
            return false;
        }

        $due = Task::wallClockString($dueDate);

        return $due !== null && substr($due, 0, 10) === self::todayDateString($user, $company);
    }
}
