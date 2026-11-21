<?php

namespace App\Services;

use App\Models\TaskboardColumn;
use App\Models\TaskLabelList;
use App\Support\ExclusionFilter;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

/**
 * The tasks list's multi-value filters, with "is not" / "is empty" / "has any"
 * (`<key>_mode`, see ExclusionFilter).
 *
 * Lives here rather than in TaskController so the query semantics can be
 * tested without a request cycle. "Is one of" behaves exactly as it did when
 * these blocks were inline in TaskController::filteredTasksQuery().
 */
class TaskFilters
{
    /** Filters that take a `<key>_mode`. The due date range takes empty / any only. */
    public const MODE_KEYS = [
        'status',
        'priority',
        'category_id',
        'project_id',
        'assigned_to',
        'assigned_by',
        'labels',
        'due_date_range',
    ];

    /**
     * Modes each filter offers (the filter modal's field config is the
     * contract; a mode it does not offer would filter with no chip or switch to
     * show it, so it is ignored and dropped from saved views).
     */
    private const KEY_MODES = [
        'status' => ['not_in'],
        'priority' => ['not_in', 'empty'],
        'category_id' => ['not_in', 'empty'],
        'project_id' => ['not_in', 'empty'],
        'assigned_to' => ['not_in', 'empty', 'any'],
        'assigned_by' => ['not_in'],
        'labels' => ['not_in', 'empty', 'any'],
        'due_date_range' => ['empty', 'any'],
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
     * Multi-select filters arrive as either a native array (`key[]=a&key[]=b`,
     * legacy links) or a comma-joined string (the redesigned filter modal —
     * FilterContext.tsx's applyFilters() joins multiselect values with "," so
     * its own URL parser can read them back). Mirrors LeadService::toValueArray().
     *
     * @return array<int, mixed>
     */
    public static function asList(mixed $value): array
    {
        if (! is_array($value)) {
            $value = $value === null || $value === '' ? [] : explode(',', (string) $value);
        }

        return array_values(array_filter(
            array_map(fn ($item) => is_string($item) ? trim($item) : $item, $value),
            fn ($item) => $item !== null && $item !== '' && $item !== 'all'
        ));
    }

    public function apply(Builder $query, Request $request): void
    {
        $this->applyStatus($query, $request);

        ExclusionFilter::column($query, $this->listFilter($request, 'priority'), 'tasks.priority', true);
        $this->applyProject($query, $request);
        ExclusionFilter::column($query, $this->listFilter($request, 'category_id'), 'tasks.task_category_id');
        ExclusionFilter::relation($query, $this->listFilter($request, 'assigned_to'), 'users', 'users.id');
        $this->applyAssignedBy($query, $request);
        ExclusionFilter::relation(
            $query,
            $this->listFilter($request, 'labels'),
            'labels',
            (new TaskLabelList)->getTable().'.id'
        );
    }

    /**
     * "No due date" / "has a due date". Replaces the due range when set, so the
     * caller only applies the range when this returns false.
     */
    public function applyDueMode(Builder $query, Request $request): bool
    {
        $mode = ExclusionFilter::modeOf($request, 'due_date_range', self::modesFor('due_date_range'));

        if ($mode === 'empty') {
            $query->whereNull('tasks.due_date');

            return true;
        }

        if ($mode === 'any') {
            $query->whereNotNull('tasks.due_date');

            return true;
        }

        return false;
    }

    /**
     * @return array{0: string, 1: array<int, string>}|null [mode, values]
     */
    private function listFilter(Request $request, string $key): ?array
    {
        return ExclusionFilter::resolve(
            ExclusionFilter::modeOf($request, $key, self::modesFor($key)),
            array_map('strval', self::asList($request->get($key)))
        );
    }

    /**
     * `pending` is a pseudo-status: everything that is not the complete
     * column. The rest are board column slugs.
     */
    private function applyStatus(Builder $query, Request $request): void
    {
        $statuses = self::asList($request->get('status'));
        if ($statuses === []) {
            return;
        }

        $hasPending = in_array('pending', $statuses, true);
        $slugs = array_values(array_filter(
            $statuses,
            static fn ($status) => $status !== 'pending'
        ));

        if (ExclusionFilter::modeOf($request, 'status', self::modesFor('status')) === 'not_in') {
            $this->applyStatusNotIn($query, $hasPending, $slugs);

            return;
        }

        if ($hasPending && $slugs !== []) {
            $query->where(function ($inner) use ($slugs) {
                $inner->pending()
                    ->orWhereHas('boardColumn', function ($columnQuery) use ($slugs) {
                        $columnQuery->whereIn('slug', $slugs);
                    });
            });
        } elseif ($hasPending) {
            $query->pending();
        } else {
            $query->whereHas('boardColumn', function ($columnQuery) use ($slugs) {
                $columnQuery->whereIn('slug', $slugs);
            });
        }
    }

    /**
     * Everything except the listed statuses. A task with no board column is not
     * in any of them, so it stays. Leaving `pending` out leaves only the
     * complete column (or no column).
     *
     * @param  array<int, mixed>  $slugs
     */
    private function applyStatusNotIn(Builder $query, bool $hasPending, array $slugs): void
    {
        if ($slugs !== []) {
            $query->whereDoesntHave('boardColumn', fn ($columnQuery) => $columnQuery->whereIn('slug', $slugs));
        }

        if (! $hasPending) {
            return;
        }

        $completeId = TaskboardColumn::completeColumn()?->id;

        if ($completeId === null) {
            // Nothing is "complete", so everything is pending: leaving pending out leaves nothing.
            $query->whereRaw('1 = 0');

            return;
        }

        $query->where(function ($q) use ($completeId) {
            $q->whereNull('tasks.board_column_id')->orWhere('tasks.board_column_id', $completeId);
        });
    }

    /**
     * Project is a single pick (with an `all` sentinel), not a list: "is" keeps
     * comparing the whole value, as it always did. "Is not" takes a list.
     */
    private function applyProject(Builder $query, Request $request): void
    {
        $mode = ExclusionFilter::modeOf($request, 'project_id', self::modesFor('project_id'));

        if ($mode === 'in') {
            if ($request->filled('project_id') && $request->get('project_id') !== 'all') {
                $query->where('project_id', $request->get('project_id'));
            }

            return;
        }

        ExclusionFilter::column($query, $this->listFilter($request, 'project_id'), 'tasks.project_id');
    }

    /** A task's assigner is whoever added it or created it, so an exclusion has to rule out both. */
    private function applyAssignedBy(Builder $query, Request $request): void
    {
        $filter = $this->listFilter($request, 'assigned_by');
        if ($filter === null) {
            return;
        }

        [$mode, $ids] = $filter;

        match ($mode) {
            'not_in' => $query
                ->where(function ($q) use ($ids) {
                    $q->whereNull('tasks.added_by')->orWhereNotIn('tasks.added_by', $ids);
                })
                ->where(function ($q) use ($ids) {
                    $q->whereNull('tasks.created_by')->orWhereNotIn('tasks.created_by', $ids);
                }),
            'empty' => $query->whereNull('tasks.added_by')->whereNull('tasks.created_by'),
            'any' => $query->where(function ($q) {
                $q->whereNotNull('tasks.added_by')->orWhereNotNull('tasks.created_by');
            }),
            default => $query->where(function ($q) use ($ids) {
                $q->whereIn('tasks.added_by', $ids)->orWhereIn('tasks.created_by', $ids);
            }),
        };
    }
}
