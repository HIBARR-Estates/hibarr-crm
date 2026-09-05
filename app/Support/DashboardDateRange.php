<?php

namespace App\Support;

use Carbon\Carbon;
use Illuminate\Http\Request;

/**
 * The window a dashboard is being read over.
 *
 * Two shapes reach the dashboards: a preset ("last 30 days") and a custom
 * from/to pair the user picked. Both end up here as a resolved pair of
 * timestamps, so panels never have to care which one they were given.
 *
 * Parsing is deliberately strict. These bounds reach date arithmetic inside
 * aggregate queries, so a value that isn't a real date is rejected and falls
 * back to the default window rather than being coerced into something
 * plausible-looking — the same reasoning behind the preset whitelist this
 * replaces.
 */
class DashboardDateRange
{
    /** Presets offered by the picker, in days. */
    public const PRESETS = [30, 90, 365];

    public const DEFAULT_DAYS = 30;

    /**
     * Longest custom range accepted, in days.
     *
     * Not a performance guard — a bound on nonsense. A five-century range is a
     * typo or a probe, and clamping it silently would report a number nobody
     * asked for.
     */
    public const MAX_DAYS = 1826;

    private function __construct(
        public readonly Carbon $from,
        public readonly Carbon $to,
        /** The preset this came from, or null when it is a custom range. */
        public readonly ?int $preset,
    ) {}

    /**
     * Read the window off the request: ?from=&to= when both parse, else
     * ?days= from the whitelist, else the default.
     */
    public static function fromRequest(Request $request): self
    {
        $custom = self::parseCustom($request->query('from'), $request->query('to'));

        if ($custom) {
            return $custom;
        }

        $days = $request->integer('days');

        return self::preset(
            in_array($days, self::PRESETS, true) ? $days : self::DEFAULT_DAYS
        );
    }

    public static function preset(int $days): self
    {
        return new self(
            now()->subDays($days)->startOfDay(),
            now()->endOfDay(),
            $days,
        );
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

        return new self($start->startOfDay(), $end->endOfDay(), null);
    }

    /**
     * Strict Y-m-d only. createFromFormat is lenient about overflow ("2026-02-31"
     * becomes 3 March), so the round-trip check rejects what it invented.
     */
    private static function parseDate(string $value): ?Carbon
    {
        $date = Carbon::createFromFormat('Y-m-d', $value);

        if (! $date || $date->format('Y-m-d') !== $value) {
            return null;
        }

        return $date;
    }

    /** Whole days covered, at least one. Presets report their own length. */
    public function days(): int
    {
        return $this->preset ?? max(1, (int) $this->from->diffInDays($this->to) + 1);
    }

    public function isCustom(): bool
    {
        return $this->preset === null;
    }

    /**
     * The shape the frontend's picker round-trips. `days` is always populated
     * so copy like "last N days" reads correctly for a custom range too.
     *
     * @return array{from: string, to: string, days: int, preset: int|null}
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
