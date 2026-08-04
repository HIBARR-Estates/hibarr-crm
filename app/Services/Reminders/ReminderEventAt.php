<?php

namespace App\Services\Reminders;

use App\Models\Company;
use Carbon\Carbon;
use Carbon\CarbonInterface;

/**
 * Shared datetime helpers for entity reminder anchors.
 *
 * Event time is always the entity's dynamic `remind_at` (UTC instant),
 * never a fixed business field like close_date / due_date / flight_date.
 */
class ReminderEventAt
{
    /**
     * Date-only helper when a caller explicitly passes a Y-m-d (rare).
     * Prefer fromDateTime() for remind_at.
     */
    public static function fromCompanyDate(mixed $date, int $companyId, string $localTime = '09:00:00'): ?CarbonInterface
    {
        if ($date === null || $date === '') {
            return null;
        }

        $timezone = Company::query()->whereKey($companyId)->value('timezone')
            ?: config('app.timezone', 'UTC');

        $ymd = $date instanceof CarbonInterface
            ? $date->format('Y-m-d')
            : Carbon::parse((string) $date)->format('Y-m-d');

        return Carbon::createFromFormat('Y-m-d H:i:s', $ymd.' '.$localTime, $timezone)->utc();
    }

    /**
     * Datetime already stored as an absolute instant (flight_date, remind_at, etc.).
     */
    public static function fromDateTime(mixed $dateTime): ?CarbonInterface
    {
        if ($dateTime === null || $dateTime === '') {
            return null;
        }

        if ($dateTime instanceof CarbonInterface) {
            return $dateTime->copy()->utc();
        }

        return Carbon::parse((string) $dateTime)->utc();
    }
}
