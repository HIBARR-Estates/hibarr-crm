<?php

namespace App\Services\AgentWorkspace;

use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;

/**
 * The five periods My report offers, and the period before each one the
 * counts are compared with. Weeks run Monday to Sunday. Pure date maths, so
 * the controller and its tests share one definition.
 */
class ReportWindows
{
    public const KEYS = ['week', 'month', 'last_month', 'quarter', 'year'];

    public const DEFAULT = 'month';

    /**
     * @return array{key: string, start: string, end: string, prev_start: string, prev_end: string}
     */
    public static function for(string $key, CarbonInterface $now): array
    {
        $at = Carbon::instance($now);

        [$start, $end, $prevStart, $prevEnd] = match ($key) {
            'week' => [
                $at->copy()->startOfWeek(Carbon::MONDAY),
                $at->copy()->endOfWeek(Carbon::SUNDAY),
                $at->copy()->subWeek()->startOfWeek(Carbon::MONDAY),
                $at->copy()->subWeek()->endOfWeek(Carbon::SUNDAY),
            ],
            'last_month' => [
                $at->copy()->startOfMonth()->subMonthNoOverflow()->startOfMonth(),
                $at->copy()->startOfMonth()->subMonthNoOverflow()->endOfMonth(),
                $at->copy()->startOfMonth()->subMonthsNoOverflow(2)->startOfMonth(),
                $at->copy()->startOfMonth()->subMonthsNoOverflow(2)->endOfMonth(),
            ],
            'quarter' => [
                $at->copy()->startOfQuarter(),
                $at->copy()->endOfQuarter(),
                $at->copy()->startOfQuarter()->subQuarterNoOverflow()->startOfQuarter(),
                $at->copy()->startOfQuarter()->subQuarterNoOverflow()->endOfQuarter(),
            ],
            'year' => [
                $at->copy()->startOfYear(),
                $at->copy()->endOfYear(),
                $at->copy()->startOfYear()->subYear()->startOfYear(),
                $at->copy()->startOfYear()->subYear()->endOfYear(),
            ],
            default => [
                $at->copy()->startOfMonth(),
                $at->copy()->endOfMonth(),
                $at->copy()->startOfMonth()->subMonthNoOverflow()->startOfMonth(),
                $at->copy()->startOfMonth()->subMonthNoOverflow()->endOfMonth(),
            ],
        };

        return [
            'key' => in_array($key, self::KEYS, true) ? $key : self::DEFAULT,
            'start' => $start->toDateString(),
            'end' => $end->toDateString(),
            'prev_start' => $prevStart->toDateString(),
            'prev_end' => $prevEnd->toDateString(),
        ];
    }

    /** Every period, keyed, so the page can switch without asking the server what a week is. */
    public static function all(CarbonInterface $now): array
    {
        $windows = [];
        foreach (self::KEYS as $key) {
            $windows[$key] = self::for($key, $now);
        }

        return $windows;
    }

    public static function normalise(?string $key): string
    {
        return in_array($key, self::KEYS, true) ? $key : self::DEFAULT;
    }
}
