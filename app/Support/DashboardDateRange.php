<?php

namespace App\Support;

use Carbon\Carbon;
use Illuminate\Http\Request;

/**
 * The window a dashboard is being read over.
 *
 * Two shapes reach the dashboards: a named/rolling preset and a custom from/to
 * pair the user picked. Both end up here as a resolved pair of timestamps, so
 * panels never have to care which one they were given.
 *
 * Parsing is deliberately strict. These bounds reach date arithmetic inside
 * aggregate queries, so a value that isn't a real date is rejected and falls
 * back to the default window rather than being coerced into something
 * plausible-looking — the same reasoning behind the preset whitelist this
 * replaces.
 */
class DashboardDateRange
{
    /**
     * Rolling presets offered by the picker, in days.
     *
     * Week / month / quarter / year. Calendar-anchored presets (YTD, all time)
     * live in NAMED_PRESETS — they are not a day count.
     */
    public const PRESETS = [7, 30, 90, 365];

    /** Calendar-anchored presets accepted as ?period=. */
    public const NAMED_PRESETS = ['ytd', 'all'];

    public const DEFAULT_DAYS = 30;

    /**
     * Floor for "all time". Named so the picker and the server agree on the
     * same span when detecting that the user clicked the preset.
     */
    public const ALL_TIME_FROM = '2000-01-01';

    /**
     * Longest custom range accepted, in days.
     *
     * Not a performance guard — a bound on nonsense. A five-century range is a
     * typo or a probe, and clamping it silently would report a number nobody
     * asked for. "All time" bypasses this via the named preset.
     */
    public const MAX_DAYS = 1826;

    private function __construct(
        public readonly Carbon $from,
        public readonly Carbon $to,
        /**
         * Rolling day count (7/30/90/365), a named key ('ytd'|'all'), or null
         * when the user picked their own dates.
         */
        public readonly int|string|null $preset,
    ) {}

    /**
     * Read the window off the request: ?period= for calendar presets, else
     * ?from=&to= when both parse, else ?days= from the whitelist, else default.
     */
    public static function fromRequest(Request $request): self
    {
        $named = self::parseNamed($request->query('period'));

        if ($named) {
            return $named;
        }

        $custom = self::parseCustom($request->query('from'), $request->query('to'));

        if ($custom) {
            return $custom;
        }

        $days = $request->integer('days');

        return self::preset(
            in_array($days, self::PRESETS, true) ? $days : self::DEFAULT_DAYS
        );
    }

    /**
     * `$days - 1`, not `$days`: today is one of the days being counted, so
     * "last 30 days" is today plus the 29 before it — 30 calendar dates in
     * total, matching what `days()` reports back to the picker. Off by one
     * the other way would make the label a day short of what the query
     * actually covers.
     */
    public static function preset(int $days): self
    {
        return new self(
            now()->subDays(max(0, $days - 1))->startOfDay(),
            now()->endOfDay(),
            $days,
        );
    }

    /** Year-to-date or all-time, resolved against today so they keep rolling. */
    public static function named(string $key): self
    {
        return match ($key) {
            'ytd' => new self(
                now()->startOfYear()->startOfDay(),
                now()->endOfDay(),
                'ytd',
            ),
            'all' => new self(
                Carbon::parse(self::ALL_TIME_FROM)->startOfDay(),
                now()->endOfDay(),
                'all',
            ),
            default => self::preset(self::DEFAULT_DAYS),
        };
    }

    private static function parseNamed(mixed $period): ?self
    {
        if (! is_string($period) || ! in_array($period, self::NAMED_PRESETS, true)) {
            return null;
        }

        return self::named($period);
    }

    /**
     * A custom range, or null when the input isn't two real dates in order.
     *
     * Reversed pairs are swapped rather than rejected: someone dragging a
     * calendar backwards means the range between the two dates, and refusing
     * it would be pedantry. Everything else — unparseable, too long, in the
     * future — falls back to the caller's default.
     */
    private static function parseCustom(mixed $from, mixed $to): ?self
    {
        if (! is_string($from) || ! is_string($to)) {
            return null;
        }

        $start = self::parseDate($from);
        $end = self::parseDate($to);

        if (! $start || ! $end) {
            return null;
        }

        if ($start->greaterThan($end)) {
            [$start, $end] = [$end, $start];
        }

        if ($start->diffInDays($end) > self::MAX_DAYS) {
            return null;
        }

        // A future window has nothing in it yet — every aggregate would read
        // as zero, which looks like an empty team rather than an invalid
        // request. Checked on the end: a range starting today and running a
        // few days ahead is still asking about days that haven't happened,
        // same as one that starts in the future.
        if ($end->isFuture()) {
            return null;
        }

        return new self($start->startOfDay(), $end->endOfDay(), null);
    }

    /**
     * Strict Y-m-d only. createFromFormat is lenient about overflow ("2026-02-31"
     * becomes 3 March), so the round-trip check rejects what it invented.
     */
    private static function parseDate(string $value): ?Carbon
    {
        try {
            $date = Carbon::createFromFormat('Y-m-d', $value);
        } catch (\InvalidArgumentException) {
            // Carbon's strict mode throws on input it can't parse at all
            // (e.g. "yesterday", an empty string) rather than returning a
            // falsy value — same outcome as the round-trip check below, just
            // reached a different way.
            return null;
        }

        if (! $date || $date->format('Y-m-d') !== $value) {
            return null;
        }

        return $date;
    }

    /** Whole days covered, at least one. Rolling presets report their own length. */
    public function days(): int
    {
        if (is_int($this->preset)) {
            return $this->preset;
        }

        return max(1, (int) $this->from->diffInDays($this->to) + 1);
    }

    public function isCustom(): bool
    {
        return $this->preset === null;
    }

    /**
     * The shape the frontend's picker round-trips. `days` is always populated
     * so copy like "last N days" reads correctly for a custom range too.
     *
     * @return array{from: string, to: string, days: int, preset: int|string|null}
     */
    public function toArray(): array
    {
        return [
            'from' => $this->from->toDateString(),
            'to' => $this->to->toDateString(),
            'days' => $this->days(),
            'preset' => $this->preset,
        ];
    }
}
