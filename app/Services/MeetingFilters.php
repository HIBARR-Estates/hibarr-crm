<?php

namespace App\Services;

use App\Support\ExclusionFilter;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

/**
 * The meetings list's multi-value filters, with "is not" / "is empty"
 * (`<key>_mode`, see ExclusionFilter). Shared by the list, the tab tallies and
 * the calendar, so a filter means the same in all three.
 *
 * "Is one of" behaves exactly as it did when these were inline in
 * MeetingsController::index().
 */
class MeetingFilters
{
    /** Filters that take a `<key>_mode`. */
    public const MODE_KEYS = ['meeting_type_id', 'status', 'location', 'host_id', 'attendance'];

    public const STATUSES = ['scheduled', 'completed', 'cancelled'];

    public const ATTENDANCE = ['attended', 'no_show'];

    /**
     * Modes each filter offers (the filter modal's field config is the
     * contract; a mode it does not offer is ignored and dropped from saved views).
     */
    private const KEY_MODES = [
        'meeting_type_id' => ['not_in', 'empty'],
        'status' => ['not_in'],
        'location' => ['not_in', 'empty'],
        'host_id' => ['not_in'],
        'attendance' => ['empty'],
    ];

    /** @return list<string> */
    public static function modesFor(string $key): array
    {
        return self::KEY_MODES[$key] ?? [];
    }

    /** @return list<string> */
    public static function modeKeys(): array
    {
        return array_map(fn (string $key) => $key.'_mode', self::MODE_KEYS);
    }

    /**
     * A comma-joined string (the filter modal, deep links) or a native array.
     *
     * @return array<int, string>
     */
    public static function csv(mixed $value): array
    {
        if (is_array($value)) {
            return array_values(array_filter($value, 'strlen'));
        }

        return is_string($value) && $value !== ''
            ? array_values(array_filter(explode(',', $value), 'strlen'))
            : [];
    }

    public function apply(Builder $query, Request $request): void
    {
        ExclusionFilter::column(
            $query,
            $this->listFilter($request, 'meeting_type_id'),
            'meeting_type_id'
        );

        ExclusionFilter::column(
            $query,
            $this->listFilter($request, 'status', self::STATUSES),
            'status'
        );

        ExclusionFilter::column(
            $query,
            $this->listFilter($request, 'location'),
            'location',
            isText: true
        );

        ExclusionFilter::column(
            $query,
            $this->listFilter($request, 'attendance', self::ATTENDANCE),
            'attendance_outcome',
            isText: true
        );

        $this->applyHost($query, $request);
    }

    /**
     * Attendance values the list was asked to *include*. None under "not
     * recorded yet": the page uses this to pick the tab, and a deep link that
     * says both should not also filter by the value.
     *
     * @return array<int, string>
     */
    public function includedAttendance(Request $request): array
    {
        if (ExclusionFilter::modeOf($request, 'attendance', self::modesFor('attendance')) !== 'in') {
            return [];
        }

        return array_values(array_intersect(self::csv($request->get('attendance')), self::ATTENDANCE));
    }

    /** "Not recorded yet": the meetings still waiting on an attendance outcome. */
    public function wantsUnrecordedAttendance(Request $request): bool
    {
        return ExclusionFilter::modeOf($request, 'attendance', self::modesFor('attendance')) === 'empty';
    }

    /**
     * @param  list<string>|null  $only  values to keep, for filters with a fixed set
     * @return array{0: string, 1: array<int, string>}|null [mode, values]
     */
    private function listFilter(Request $request, string $key, ?array $only = null): ?array
    {
        $values = self::csv($request->get($key));

        if ($only !== null) {
            $values = array_values(array_intersect($values, $only));
        }

        return ExclusionFilter::resolve(ExclusionFilter::modeOf($request, $key, self::modesFor($key)), $values);
    }

    /**
     * "Host" reads as whoever owns the meeting: the named host where one is
     * set, otherwise the person who booked it. An exclusion has to use the same
     * reading, so a meeting is "not Anna's" when its owner is somebody else.
     */
    private function applyHost(Builder $query, Request $request): void
    {
        $filter = $this->listFilter($request, 'host_id');
        if ($filter === null) {
            return;
        }

        [$mode, $hostIds] = $filter;

        if ($mode === 'not_in') {
            $query->where(function ($owner) use ($hostIds) {
                $owner->where(function ($named) use ($hostIds) {
                    $named->whereNotNull('host_id')->whereNotIn('host_id', $hostIds);
                })->orWhere(function ($booked) use ($hostIds) {
                    $booked->whereNull('host_id')->where(function ($by) use ($hostIds) {
                        $by->whereNull('added_by')->orWhereNotIn('added_by', $hostIds);
                    });
                });
            });

            return;
        }

        $query->where(function ($inner) use ($hostIds) {
            $inner->whereIn('host_id', $hostIds)
                ->orWhere(function ($fallback) use ($hostIds) {
                    $fallback->whereNull('host_id')->whereIn('added_by', $hostIds);
                });
        });
    }
}
