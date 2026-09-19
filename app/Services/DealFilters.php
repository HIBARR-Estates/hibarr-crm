<?php

namespace App\Services;

use App\Support\LeadSearchQuery;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

/**
 * Query filters for the deals list, kanban board columns and column totals.
 *
 * One place so a filter added to the modal applies everywhere the list is
 * counted — the board previously honoured only search/category/agent, so the
 * column counts disagreed with the table.
 *
 * Multiselect values arrive comma-joined (see FilterContext.tsx); a native
 * array param (`key[]=a&key[]=b`) is accepted too.
 */
class DealFilters
{
    /**
     * Everything except pipeline/stage, which callers scope themselves
     * (a kanban column *is* a stage).
     */
    public function apply(Builder $query, Request $request): void
    {
        if ($request->filled('search')) {
            $search = (string) $request->get('search');
            $term = '%'.$search.'%';
            $query->where(function ($q) use ($term, $search) {
                $q->where('deals.name', 'like', $term)
                    ->orWhereHas('contact', function ($cq) use ($term, $search) {
                        $cq->where('client_name', 'like', $term)
                            ->orWhere('client_email', 'like', $term)
                            ->orWhere('company_name', 'like', $term);
                        LeadSearchQuery::applyContactMethodMatch($cq, $search);
                    });
            });
        }

        if ($values = $this->values($request, 'category_id')) {
            $query->whereIn('deals.category_id', $values);
        }

        if ($values = $this->values($request, 'source_id')) {
            $query->whereHas('contact', fn ($q) => $q->whereIn('source_id', $values));
        }

        if ($values = $this->values($request, 'package_id')) {
            $query->whereHas('packages', fn ($q) => $q->whereIn('packages.id', $values));
        }

        // agent_id carries the *user* id, matching the agent picker everywhere else.
        if ($request->get('agent_status') === 'unassigned') {
            $query->whereNull('deals.agent_id');
        } elseif ($values = $this->values($request, 'agent_id')) {
            $query->whereHas('leadAgent', fn ($q) => $q->whereIn('user_id', $values));
        } elseif ($request->get('agent_status') === 'active') {
            $query->whereHas('leadAgent.user', fn ($q) => $q->where('status', 'active'));
        } elseif ($request->get('agent_status') === 'inactive') {
            $query->whereHas('leadAgent.user', fn ($q) => $q->where('status', '!=', 'active'));
        }

        // "open" means no outcome recorded yet, so it cannot be a plain whereIn.
        if ($values = $this->values($request, 'outcome_status')) {
            $includeOpen = in_array('open', $values, true);
            $recorded = array_values(array_diff($values, ['open']));

            $query->where(function ($q) use ($includeOpen, $recorded) {
                if ($includeOpen) {
                    $q->orWhereNull('deals.outcome_status');
                }
                if ($recorded !== []) {
                    $q->orWhereIn('deals.outcome_status', $recorded);
                }
            });
        }

        if ($request->filled('is_locked')) {
            $query->where('deals.is_locked', $request->boolean('is_locked'));
        }

        // "Idle N days" — no update since the cutoff. Same measurement the
        // personal dashboard's pipeline split counts against (updated_at, not
        // a stalled-stage rule — target_duration_days is NULL on every stage).
        if ($request->filled('idle_days') && (int) $request->get('idle_days') > 0) {
            $query->where('deals.updated_at', '<', now()->subDays((int) $request->get('idle_days')));
        }

        $this->applyDateRange($query, $request, 'deals.created_at', 'start_date', 'end_date');
        $this->applyDateRange($query, $request, 'deals.close_date', 'close_start', 'close_end');

        if ($request->filled('min_value_range')) {
            $query->where('deals.value', '>=', (float) $request->get('min_value_range'));
        }

        if ($request->filled('max_value_range')) {
            $query->where('deals.value', '<=', (float) $request->get('max_value_range'));
        }
    }

    /**
     * Either bound on its own is a valid filter — the modal's range picker
     * allows an open-ended range.
     */
    private function applyDateRange(
        Builder $query,
        Request $request,
        string $column,
        string $fromKey,
        string $toKey
    ): void {
        if ($request->filled($fromKey)) {
            $query->where($column, '>=', $request->get($fromKey).' 00:00:00');
        }

        if ($request->filled($toKey)) {
            $query->where($column, '<=', $request->get($toKey).' 23:59:59');
        }
    }

    /**
     * @return array<int, string>
     */
    public function values(Request $request, string $key): array
    {
        $value = $request->get($key);

        if (is_array($value)) {
            $value = implode(',', $value);
        }

        if ($value === null || $value === '' || $value === 'all') {
            return [];
        }

        return array_values(array_filter(
            array_map('trim', explode(',', (string) $value)),
            fn ($v) => $v !== '' && $v !== 'all'
        ));
    }
}
