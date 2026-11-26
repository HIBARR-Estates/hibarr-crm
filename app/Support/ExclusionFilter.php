<?php

namespace App\Support;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

/**
 * "Is not", "Is empty" and "Has any" for list filters, read from the
 * companion param `<key>_mode` next to the filter's own values.
 *
 *  - not_in:  everything except the values. A record with no value at all is
 *             "not in" the list, so it stays — SQL's NOT IN drops NULLs, which
 *             would hide exactly the records people ask for.
 *  - empty:   the record has no value (values are ignored)
 *  - any:     the record has some value (values are ignored)
 *
 * No mode means "is one of", the behaviour every filter had before. Shared by
 * the Leads, Deals and Tasks filters so all three read a mode the same way.
 */
final class ExclusionFilter
{
    public const MODES = ['not_in', 'empty', 'any'];

    /** Modes that carry no values of their own. */
    private const VALUELESS = ['empty', 'any', 'active', 'inactive'];

    /**
     * `in` (the default), or one of `$allowed` from the `<key>_mode` param.
     * A word that is not allowed is not a mode.
     *
     * @param  list<string>  $allowed
     */
    public static function modeOf(Request $request, string $key, array $allowed = self::MODES): string
    {
        $mode = $request->get($key.'_mode');

        return is_string($mode) && in_array($mode, $allowed, true) ? $mode : 'in';
    }

    /**
     * Pair a mode with its values; null when the filter is idle (a mode that
     * needs values, and none picked).
     *
     * @param  array<int, string>  $values
     * @return array{0: string, 1: array<int, string>}|null [mode, values]
     */
    public static function resolve(string $mode, array $values): ?array
    {
        if (in_array($mode, self::VALUELESS, true)) {
            return [$mode, []];
        }

        return $values === [] ? null : [$mode, $values];
    }

    /**
     * One scalar column. Text columns also count a blank string as empty.
     *
     * @param  array{0: string, 1: array<int, string>}|null  $filter
     */
    public static function column(Builder $query, ?array $filter, string $column, bool $isText = false): void
    {
        if ($filter === null) {
            return;
        }

        [$mode, $values] = $filter;

        match ($mode) {
            'not_in' => $query->where(function ($q) use ($column, $values) {
                $q->whereNull($column)->orWhereNotIn($column, $values);
            }),
            'empty' => $query->where(function ($q) use ($column, $isText) {
                $q->whereNull($column);
                if ($isText) {
                    $q->orWhere($column, '');
                }
            }),
            'any' => $query->whereNotNull($column)
                ->when($isText, fn ($q) => $q->where($column, '<>', '')),
            default => $query->whereIn($column, $values),
        };
    }

    /**
     * A to-many relation (labels, packages, assignees): has one in the list,
     * has none of them, has none at all, or has at least one.
     *
     * @param  array{0: string, 1: array<int, string>}|null  $filter
     */
    public static function relation(Builder $query, ?array $filter, string $relation, string $idColumn): void
    {
        if ($filter === null) {
            return;
        }

        [$mode, $values] = $filter;

        match ($mode) {
            'not_in' => $query->whereDoesntHave($relation, fn ($q) => $q->whereIn($idColumn, $values)),
            'empty' => $query->whereDoesntHave($relation),
            'any' => $query->whereHas($relation),
            default => $query->whereHas($relation, fn ($q) => $q->whereIn($idColumn, $values)),
        };
    }
}
