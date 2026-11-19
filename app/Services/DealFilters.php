<?php

namespace App\Services;

use App\Support\ExclusionFilter;
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
     * Modes a filter takes, where that is fewer than all of them. The filter
     * modal's field config is the contract: a mode it does not offer would
     * filter with no chip or switch to show it, so it is ignored. (Pipeline and
     * stage are required columns that the board and the table both scope by,
     * so only "is not" means anything there.)
     */
    private const KEY_MODES = [
        'lead_pipeline_id' => ['not_in'],
        'pipeline_stage_id' => ['not_in'],
        'category_id' => ['not_in', 'empty'],
        'source_id' => ['not_in', 'empty'],
    ];

    /** @return list<string> */
    private function modesFor(string $key): array
    {
        return self::KEY_MODES[$key] ?? ExclusionFilter::MODES;
    }

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

        $this->applyColumn($query, $request, 'category_id', 'deals.category_id');
        $this->applySource($query, $request);
        ExclusionFilter::relation($query, $this->listFilter($request, 'package_id'), 'packages', 'packages.id');
        $this->applyAgent($query, $request);

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

        // "Not closed" / "has a close date" replace the range, they don't add to it.
        match (ExclusionFilter::modeOf($request, 'close_start', ['empty', 'any'])) {
            'empty' => $query->whereNull('deals.close_date'),
            'any' => $query->whereNotNull('deals.close_date'),
            default => $this->applyDateRange($query, $request, 'deals.close_date', 'close_start', 'close_end'),
        };

        // A deal's value starts at 0, so "no value" is NULL or 0: a deal nobody
        // has priced yet is not a deal worth nothing.
        if (ExclusionFilter::modeOf($request, 'value_range', ['empty']) === 'empty') {
            $query->where(function ($q) {
                $q->whereNull('deals.value')->orWhere('deals.value', 0);
            });

            return;
        }

        if ($request->filled('min_value_range')) {
            $query->where('deals.value', '>=', (float) $request->get('min_value_range'));
        }

        if ($request->filled('max_value_range')) {
            $query->where('deals.value', '<=', (float) $request->get('max_value_range'));
        }
    }

    /**
     * One scalar column with the exclusion modes (category, and the pipeline
     * and stage the controllers scope themselves).
     */
    public function applyColumn(Builder $query, Request $request, string $key, string $column): void
    {
        ExclusionFilter::column($query, $this->listFilter($request, $key), $column);
    }

    /**
     * The values a filter was asked to *include*, and nothing under an
     * exclusion mode. For choosing the one pipeline a board shows: "every
     * pipeline except 2" is not a pipeline to open.
     *
     * @return array<int, string>
     */
    public function includedValues(Request $request, string $key): array
    {
        return ExclusionFilter::modeOf($request, $key, $this->modesFor($key)) === 'in'
            ? $this->values($request, $key)
            : [];
    }

    /**
     * The first pipeline, in the order given, that "is not" has not ruled out;
     * null when every candidate is excluded. A board shows one pipeline, and
     * falling back to the default one would open it on the very pipeline the
     * filter excludes whenever the default is the excluded one.
     *
     * @param  array<int, int|string|null>  $candidateIds  in order of preference
     */
    public function firstPipelineNotExcluded(Request $request, array $candidateIds): ?int
    {
        foreach ($candidateIds as $id) {
            if ($id !== null && ! $this->pipelineExcluded($request, $id)) {
                return (int) $id;
            }
        }

        return null;
    }

    /** Whether the pipeline filter is an "is not" that rules this pipeline out. */
    public function pipelineExcluded(Request $request, int|string|null $pipelineId): bool
    {
        if ($pipelineId === null) {
            return false;
        }

        return ExclusionFilter::modeOf($request, 'lead_pipeline_id', $this->modesFor('lead_pipeline_id')) === 'not_in'
            && in_array((string) $pipelineId, $this->values($request, 'lead_pipeline_id'), true);
    }

    /**
     * @return array{0: string, 1: array<int, string>}|null [mode, values]
     */
    private function listFilter(Request $request, string $key): ?array
    {
        return ExclusionFilter::resolve(
            ExclusionFilter::modeOf($request, $key, $this->modesFor($key)),
            $this->values($request, $key)
        );
    }

    /** The source lives on the deal's contact, so "empty" means the contact has none. */
    private function applySource(Builder $query, Request $request): void
    {
        $filter = $this->listFilter($request, 'source_id');
        if ($filter === null) {
            return;
        }

        [$mode, $values] = $filter;

        match ($mode) {
            'not_in' => $query->whereDoesntHave('contact', fn ($q) => $q->whereIn('source_id', $values)),
            'empty' => $query->whereDoesntHave('contact', fn ($q) => $q->whereNotNull('source_id')),
            'any' => $query->whereHas('contact', fn ($q) => $q->whereNotNull('source_id')),
            default => $query->whereHas('contact', fn ($q) => $q->whereIn('source_id', $values)),
        };
    }

    /**
     * agent_id carries the *user* id, matching the agent picker everywhere
     * else. Besides the shared modes, an agent can be asked for by status
     * (`active` / `inactive`); the older `agent_status` param still works.
     */
    private function applyAgent(Builder $query, Request $request): void
    {
        $mode = ExclusionFilter::modeOf($request, 'agent_id', [...ExclusionFilter::MODES, 'active', 'inactive']);
        $values = $this->values($request, 'agent_id');

        switch ($mode) {
            case 'empty':
                $query->whereNull('deals.agent_id');

                return;
            case 'any':
                $query->whereNotNull('deals.agent_id');

                return;
            case 'active':
                $query->whereHas('leadAgent.user', fn ($q) => $q->where('status', 'active'));

                return;
            case 'inactive':
                $query->whereHas('leadAgent.user', fn ($q) => $q->where('status', '!=', 'active'));

                return;
            case 'not_in':
                // No agent at all is also "not one of these".
                if ($values !== []) {
                    $query->where(function ($q) use ($values) {
                        $q->whereNull('deals.agent_id')
                            ->orWhereDoesntHave('leadAgent', fn ($agent) => $agent->whereIn('user_id', $values));
                    });
                }

                return;
        }

        if ($request->get('agent_status') === 'unassigned') {
            $query->whereNull('deals.agent_id');
        } elseif ($values !== []) {
            $query->whereHas('leadAgent', fn ($q) => $q->whereIn('user_id', $values));
        } elseif ($request->get('agent_status') === 'active') {
            $query->whereHas('leadAgent.user', fn ($q) => $q->where('status', 'active'));
        } elseif ($request->get('agent_status') === 'inactive') {
            $query->whereHas('leadAgent.user', fn ($q) => $q->where('status', '!=', 'active'));
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
