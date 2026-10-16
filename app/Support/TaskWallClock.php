<?php

namespace App\Support;

use App\Models\Company;
use App\Models\Task;
use App\Models\User;
use Illuminate\Support\Carbon;

/**
 * Wall-clock basis for task dates.
 *
 * `tasks.due_date` and `tasks.start_date` hold true UTC instants: every live
 * write path goes through {@see UserTimezone::interpretWallClock()}, which is
 * *not* feature-flagged (`created_at` matches, since the app timezone is
 * configured to UTC). That splits task dates across two bases, and mixing them
 * silently shifts every result by the viewer's UTC offset:
 *
 * - Viewer wall clock ({@see timezone()}): what a person means by "17:00" and
 *   "today". Use it when *rendering* a date — see {@see Task::wallClockString()}
 *   — or when comparing a date against another already-converted wall clock.
 * - UTC: the literal column contents. Use it for anything that filters or
 *   compares the raw column — {@see dayBounds()}, {@see utcTodayBounds()},
 *   {@see utcNowDateTimeString()}.
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

    /**
     * "Now" as digits in the viewer wall clock. Comparable only against
     * {@see Task::wallClockString()} output — see {@see utcNowDateTimeString()}
     * for the raw-column equivalent.
     */
    public static function nowDateTimeString(?User $user = null, ?Company $company = null): string
    {
        return self::now($user, $company)->format('Y-m-d H:i:s');
    }

    /**
     * "Now" as UTC digits, for comparing against a raw UTC column
     * (`due_date`, `created_at`) that has *not* been converted to the viewer
     * wall clock. Using {@see nowDateTimeString()} here compares UTC storage
     * against local digits and reports tasks overdue by up to a full day early.
     *
     * Takes no viewer: the bound is an instant, not a wall clock, so it is the
     * same for everyone.
     */
    public static function utcNowDateTimeString(): string
    {
        return now()->utc()->format('Y-m-d H:i:s');
    }

    /**
     * "Now" in the same wall-clock basis as the due dates the frontend
     * receives, so browser-side bucketing stays on one basis.
     */
    public static function wallClockNowString(?User $user = null, ?Company $company = null): string
    {
        return self::nowDateTimeString($user, $company);
    }

    /**
     * Inclusive calendar-day bounds for YYYY-MM-DD filter params, as UTC
     * digits ready for `whereBetween` on a UTC column. The viewer's day starts
     * and ends at *their* midnight, which is a different instant per viewer —
     * a task due 01:00 local on 2026-09-25 is stored as 22:00 UTC on 2026-09-24
     * and would otherwise fall outside naive local bounds.
     *
     * @param  array{0: string, 1: string}  $range
     * @return array{0: string, 1: string}
     */
    public static function dayBounds(array $range, ?User $user = null, ?Company $company = null): array
    {
        $tz = self::timezone($user, $company);

        return [
            Carbon::parse($range[0], $tz)->startOfDay()->utc()->format('Y-m-d H:i:s'),
            Carbon::parse($range[1], $tz)->endOfDay()->utc()->format('Y-m-d H:i:s'),
        ];
    }

    /**
     * The viewer's current day as UTC bounds, for "due today" filters on a raw
     * UTC column. Not a single `DATE(due_date) = ?`: the viewer's day can span
     * two (or three, across DST) UTC dates.
     *
     * @return array{0: string, 1: string}
     */
    public static function utcTodayBounds(?User $user = null, ?Company $company = null): array
    {
        $today = self::todayDateString($user, $company);

        return self::dayBounds([$today, $today], $user, $company);
    }

    public static function isDueOnViewerToday(?Carbon $dueDate, ?User $user = null, ?Company $company = null): bool
    {
        if ($dueDate === null) {
            return false;
        }

        $due = Task::wallClockString($dueDate, $user, $company);

        return $due !== null && substr($due, 0, 10) === self::todayDateString($user, $company);
    }
}
