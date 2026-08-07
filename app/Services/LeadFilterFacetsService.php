<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

/**
 * Option counts shown next to each filter choice in the Leads filter modal
 * ("Meta Ads 1,204"). One GROUP BY per dimension, always inside the caller's
 * view-lead permission scope.
 *
 * ponytail: counts describe the whole visible set, not the currently-drafted
 * filter combination — recomputing per keystroke would mean a round trip per
 * toggle. Move to a live per-draft endpoint only if users ask for it.
 */
class LeadFilterFacetsService
{
    public function __construct(
        private readonly LeadService $leadService,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function facets(): array
    {
        return [
            'total' => $this->leadService->scopedQuery()->count(),
            'temperature' => $this->countBy('temperature'),
            'lifecycle_status_id' => $this->countBy('lead_lifecycle_status_id'),
            'lead_source' => $this->countBy('source_id'),
            'lead_owner_id' => $this->countBy('lead_owner'),
            'added_by_id' => $this->countBy('added_by'),
            'gender' => $this->countBy('gender'),
            'age_range' => $this->countBy('age_range'),
            'category_id' => $this->countCategories(),
        ];
    }

    /**
     * Counts keyed by column value, e.g. ['hot' => 418, 'warm' => 1102].
     *
     * @return array<string, int>
     */
    private function countBy(string $column): array
    {
        return $this->leadService->scopedQuery()
            ->whereNotNull($column)
            ->groupBy($column)
            ->pluck(DB::raw('count(*) as aggregate'), $column)
            ->mapWithKeys(fn ($count, $value) => [(string) $value => (int) $count])
            ->all();
    }

    /**
     * Categories are many-to-many; the pivot is the superset (leads.category_id
     * only mirrors the primary), so count from the pivot.
     *
     * @return array<string, int>
     */
    private function countCategories(): array
    {
        return $this->leadService->scopedQuery()
            ->join('lead_lead_category', 'lead_lead_category.lead_id', '=', 'leads.id')
            ->groupBy('lead_lead_category.lead_category_id')
            ->pluck(
                DB::raw('count(distinct leads.id) as aggregate'),
                'lead_lead_category.lead_category_id'
            )
            ->mapWithKeys(fn ($count, $value) => [(string) $value => (int) $count])
            ->all();
    }
}
