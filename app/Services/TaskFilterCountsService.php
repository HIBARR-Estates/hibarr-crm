<?php

namespace App\Services;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Schema;

/**
 * Aggregated task counts for the redesigned Tasks workspace — one MySQL
 * round-trip per count shape instead of cloning the filter query N times.
 */
class TaskFilterCountsService
{
    /**
     * Quick-pill counts (all / mine / byme / open / today / overdue / mentioned)
     * against the current filter set, before the active quick_filter is applied.
     *
     * @return array{all: int, mine: int, byme: int, open: int, today: int, overdue: int, mentioned: int}
     */
    public function quickFilterCounts(Builder $baseQuery, int $userId): array
    {
        $query = $this->prepareAggregateQuery($baseQuery);
        $today = now()->toDateString();
        $now = now()->toDateTimeString();
        $hasParticipantsTable = Schema::hasTable('task_participants');

        $query->selectRaw('COUNT(DISTINCT tasks.id) as count_all')
            ->selectRaw(
                'SUM(CASE WHEN tasks.added_by = ? THEN 1 ELSE 0 END) as count_byme',
                [$userId]
            )
            ->selectRaw(
                'SUM(CASE WHEN EXISTS (
                    SELECT 1 FROM task_users
                    WHERE task_users.task_id = tasks.id
                      AND task_users.user_id = ?
                ) THEN 1 ELSE 0 END) as count_mine',
                [$userId]
            )
            ->selectRaw(
                'SUM(CASE WHEN EXISTS (
                    SELECT 1 FROM taskboard_columns
                    WHERE taskboard_columns.id = tasks.board_column_id
                      AND taskboard_columns.slug <> ?
                ) THEN 1 ELSE 0 END) as count_open',
                ['done']
            )
            ->selectRaw(
                'SUM(CASE WHEN tasks.due_date IS NOT NULL
                    AND DATE(tasks.due_date) = ? THEN 1 ELSE 0 END) as count_today',
                [$today]
            )
            ->selectRaw(
                'SUM(CASE WHEN tasks.due_date IS NOT NULL
                    AND tasks.due_date < ?
                    AND EXISTS (
                        SELECT 1 FROM taskboard_columns
                        WHERE taskboard_columns.id = tasks.board_column_id
                          AND taskboard_columns.slug <> ?
                    ) THEN 1 ELSE 0 END) as count_overdue',
                [$now, 'done']
            );

        if ($hasParticipantsTable) {
            $query->selectRaw(
                'SUM(CASE WHEN EXISTS (
                    SELECT 1 FROM task_participants
                    WHERE task_participants.task_id = tasks.id
                      AND task_participants.user_id = ?
                ) THEN 1 ELSE 0 END) as count_mentioned',
                [$userId]
            );
        } else {
            $query->selectRaw('0 as count_mentioned');
        }

        $row = $query->first();

        return [
            'all' => (int) ($row->count_all ?? 0),
            'mine' => (int) ($row->count_mine ?? 0),
            'byme' => (int) ($row->count_byme ?? 0),
            'open' => (int) ($row->count_open ?? 0),
            'today' => (int) ($row->count_today ?? 0),
            'overdue' => (int) ($row->count_overdue ?? 0),
            'mentioned' => (int) ($row->count_mentioned ?? 0),
        ];
    }

    /**
     * Headline stats for the redesigned workspace (after quick_filter is applied).
     *
     * @return array{total: int, completed: int, overdue: int, dueToday: int}
     */
    public function workspaceStats(Builder $baseQuery): array
    {
        $query = $this->prepareAggregateQuery($baseQuery);
        $today = now()->toDateString();
        $now = now()->toDateTimeString();

        $row = $query
            ->selectRaw('COUNT(DISTINCT tasks.id) as count_total')
            ->selectRaw(
                'SUM(CASE WHEN EXISTS (
                    SELECT 1 FROM taskboard_columns
                    WHERE taskboard_columns.id = tasks.board_column_id
                      AND taskboard_columns.slug = ?
                ) THEN 1 ELSE 0 END) as count_completed',
                ['done']
            )
            ->selectRaw(
                'SUM(CASE WHEN tasks.due_date IS NOT NULL
                    AND tasks.due_date < ?
                    AND EXISTS (
                        SELECT 1 FROM taskboard_columns
                        WHERE taskboard_columns.id = tasks.board_column_id
                          AND taskboard_columns.slug <> ?
                    ) THEN 1 ELSE 0 END) as count_overdue',
                [$now, 'done']
            )
            ->selectRaw(
                'SUM(CASE WHEN tasks.due_date IS NOT NULL
                    AND DATE(tasks.due_date) = ? THEN 1 ELSE 0 END) as count_due_today',
                [$today]
            )
            ->first();

        return [
            'total' => (int) ($row->count_total ?? 0),
            'completed' => (int) ($row->count_completed ?? 0),
            'overdue' => (int) ($row->count_overdue ?? 0),
            'dueToday' => (int) ($row->count_due_today ?? 0),
        ];
    }

    /** Strip ordering/eager loads so aggregation scans the filtered set once. */
    private function prepareAggregateQuery(Builder $query): Builder
    {
        $aggregate = clone $query;

        $aggregate->getQuery()->orders = [];
        $aggregate->getQuery()->unionOrders = [];
        $aggregate->getQuery()->limit = null;
        $aggregate->getQuery()->offset = null;
        $aggregate->setEagerLoads([]);

        // Avoid select-column collisions from the listing query.
        $aggregate->select($aggregate->getModel()->getTable().'.id');

        return $aggregate;
    }
}
