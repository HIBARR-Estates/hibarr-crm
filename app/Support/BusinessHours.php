<?php

namespace App\Support;

use DateTimeImmutable;
use DateTimeZone;

/**
 * Working-hours arithmetic for contact SLAs. A "window" is the shape OL sends:
 * ['timezone' => 'Europe/Berlin', 'days' => [1..7], 'start' => '09:00', 'end' => '18:00'] where days
 * are ISO weekdays (1 = Monday). A null window means round the clock.
 *
 * Plain DateTime on purpose, no framework: the rules are easy to get subtly wrong (day boundaries,
 * daylight saving) and are worth testing in isolation. Times are always computed on the local wall
 * clock of the window's timezone, so "9:00" stays 9:00 across a clock change.
 */
class BusinessHours
{
    /** Guards the day-by-day walk. A one-minute window needs ~10,000 days for seven days of SLA. */
    private const MAX_DAYS = 20000;

    /**
     * The moment $seconds of working time have passed since $from. Time outside the window does not
     * count, so a lead arriving at 20:00 with a 10-minute SLA and a 09:00 start is due at 09:10.
     *
     * @param  array<string, mixed>|null  $window
     */
    public static function addWorkingSeconds(DateTimeImmutable $from, int $seconds, ?array $window): DateTimeImmutable
    {
        if ($window === null) {
            return $from->modify("+{$seconds} seconds");
        }

        $remaining = max(0, $seconds);
        $cursor = $from;

        foreach (self::segmentsFrom($from, $window) as [$start, $end]) {
            $from = $cursor > $start ? $cursor : $start;
            $available = $end->getTimestamp() - $from->getTimestamp();
            if ($available <= 0) {
                continue;
            }
            if ($remaining <= $available) {
                return $from->modify("+{$remaining} seconds");
            }
            $remaining -= $available;
        }

        // Unreachable for a valid window (the walk is bounded and every window has working time).
        return $cursor->modify("+{$seconds} seconds");
    }

    /**
     * Working seconds between two moments (0 when $to is not after $from).
     *
     * @param  array<string, mixed>|null  $window
     */
    public static function workingSecondsBetween(DateTimeImmutable $from, DateTimeImmutable $to, ?array $window): int
    {
        if ($to <= $from) {
            return 0;
        }
        if ($window === null) {
            return $to->getTimestamp() - $from->getTimestamp();
        }

        $total = 0;
        foreach (self::segmentsFrom($from, $window) as [$start, $end]) {
            if ($start >= $to) {
                break;
            }
            $segmentStart = $from > $start ? $from : $start;
            $segmentEnd = $to < $end ? $to : $end;
            if ($segmentEnd > $segmentStart) {
                $total += $segmentEnd->getTimestamp() - $segmentStart->getTimestamp();
            }
        }

        return $total;
    }

    /**
     * @param  array<string, mixed>|null  $window
     */
    public static function isOpen(DateTimeImmutable $at, ?array $window): bool
    {
        if ($window === null) {
            return true;
        }

        $zone = new DateTimeZone($window['timezone']);
        $local = $at->setTimezone($zone);
        if (! in_array((int) $local->format('N'), array_map('intval', $window['days']), true)) {
            return false;
        }
        [$start, $end] = self::dayBounds($local, $window);

        return $local >= $start && $local < $end;
    }

    /**
     * The start of the next working period at or after $from ($from itself when the window is open).
     *
     * @param  array<string, mixed>|null  $window
     */
    public static function nextOpening(DateTimeImmutable $from, ?array $window): DateTimeImmutable
    {
        if ($window === null || self::isOpen($from, $window)) {
            return $from;
        }

        foreach (self::segmentsFrom($from, $window) as [$start, $end]) {
            if ($start >= $from) {
                return $start;
            }
        }

        return $from;
    }

    /**
     * Working periods in order, starting with the one that contains or follows $from. Each is
     * [start, end] on the same local day.
     *
     * @param  array<string, mixed>  $window
     * @return \Generator<int, array{0: DateTimeImmutable, 1: DateTimeImmutable}>
     */
    private static function segmentsFrom(DateTimeImmutable $from, array $window): \Generator
    {
        $zone = new DateTimeZone($window['timezone']);
        $days = array_map('intval', $window['days']);
        $day = $from->setTimezone($zone)->setTime(0, 0);

        for ($i = 0; $i < self::MAX_DAYS; $i++, $day = $day->modify('+1 day')) {
            if (! in_array((int) $day->format('N'), $days, true)) {
                continue;
            }
            [$start, $end] = self::dayBounds($day, $window);
            if ($end > $from) {
                yield [$start, $end];
            }
        }
    }

    /**
     * @param  array<string, mixed>  $window
     * @return array{0: DateTimeImmutable, 1: DateTimeImmutable}
     */
    private static function dayBounds(DateTimeImmutable $localDay, array $window): array
    {
        [$sh, $sm] = array_map('intval', explode(':', $window['start']));
        [$eh, $em] = array_map('intval', explode(':', $window['end']));

        return [$localDay->setTime($sh, $sm), $localDay->setTime($eh, $em)];
    }
}
