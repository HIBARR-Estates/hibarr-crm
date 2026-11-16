<?php

namespace App\Services\AgentWorkspace;

use App\Models\CustomField;
use App\Models\Deal;
use App\Models\Lead;
use App\Models\PipelineAnalysisScript;
use App\Support\FeatureFlags;
use Illuminate\Support\Collection;

/**
 * How far each deal's analysis has got, for the agenda's meeting chips
 * (canvas L7-02: "Analysis 5 of 9", "Ready"). Counts the fields the
 * pipeline's analysis script asks for and how many already hold a value,
 * for a whole list of deals in a handful of queries.
 *
 * The deal page's analysis also hides fields whose show-rules don't match;
 * this count does not evaluate show-rules, so a conditional field counts
 * toward the total here. Good enough for a chip; the analysis itself is
 * the exact count.
 */
class DealAnalysisProgress
{
    private const FIELD_ITEM_TYPES = ['deal_custom_field', 'lead_custom_field'];

    /**
     * @param  array<int>  $dealIds
     * @return array<int, array{ready: bool, filled: int, total: int}>
     */
    public function forDeals(array $dealIds): array
    {
        $dealIds = array_values(array_unique(array_filter(array_map('intval', $dealIds))));
        if ($dealIds === [] || ! FeatureFlags::enabled('crm.deal-analysis')) {
            return [];
        }

        $deals = Deal::query()
            ->whereIn('id', $dealIds)
            ->get(['id', 'lead_id', 'lead_pipeline_id', 'analysis_completed_at']);

        $scripts = PipelineAnalysisScript::query()
            ->with('items')
            ->whereIn('pipeline_id', $deals->pluck('lead_pipeline_id')->filter()->unique()->values())
            ->get()
            ->keyBy('pipeline_id');

        $categoryFields = $this->categoryFields($scripts);

        $values = Deal::loadCustomFieldsDataBatch([
            Deal::class => $deals->pluck('id')->all(),
            Lead::class => $deals->pluck('lead_id')->filter()->all(),
        ]);

        $out = [];
        foreach ($deals as $deal) {
            if ($deal->analysis_completed_at) {
                $out[(int) $deal->id] = ['ready' => true, 'filled' => 0, 'total' => 0];

                continue;
            }

            $script = $scripts->get($deal->lead_pipeline_id);
            if (! $script) {
                continue;
            }

            $dealValues = $values[Deal::class][$deal->id] ?? collect();
            $leadValues = $deal->lead_id ? ($values[Lead::class][$deal->lead_id] ?? collect()) : collect();
            $filled = 0;
            $total = 0;

            foreach ($script->items as $item) {
                $fieldIds = match (true) {
                    in_array($item->type, self::FIELD_ITEM_TYPES, true) => [(int) $item->item_key],
                    $item->type === 'custom_field_category' => $categoryFields->get((int) $item->item_key, []),
                    default => [],
                };
                $source = $item->type === 'lead_custom_field' ? $leadValues : $dealValues;

                foreach ($fieldIds as $fieldId) {
                    $total++;
                    if ($this->isFilled($source->get('field_'.$fieldId))) {
                        $filled++;
                    }
                }
            }

            if ($total > 0) {
                $out[(int) $deal->id] = ['ready' => false, 'filled' => $filled, 'total' => $total];
            }
        }

        return $out;
    }

    /**
     * Deal field ids per category, for script sections that pull in a whole
     * category (file fields are left out, as in the analysis).
     *
     * @param  Collection<int, PipelineAnalysisScript>  $scripts
     * @return Collection<int, array<int>>
     */
    private function categoryFields(Collection $scripts): Collection
    {
        $categoryIds = $scripts
            ->flatMap(fn (PipelineAnalysisScript $script) => $script->items)
            ->where('type', 'custom_field_category')
            ->pluck('item_key')
            ->map(fn ($id) => (int) $id)
            ->filter()
            ->unique()
            ->values();

        if ($categoryIds->isEmpty()) {
            return collect();
        }

        return CustomField::query()
            ->whereIn('custom_field_category_id', $categoryIds)
            ->where('type', '<>', 'file')
            ->orderBy('id')
            ->get(['id', 'custom_field_category_id'])
            ->groupBy('custom_field_category_id')
            ->map(fn (Collection $fields) => $fields->pluck('id')->map(fn ($id) => (int) $id)->all());
    }

    private function isFilled(mixed $value): bool
    {
        if ($value === null || $value === '') {
            return false;
        }
        if (is_string($value)) {
            $decoded = json_decode($value, true);
            if (is_array($decoded)) {
                return $decoded !== [];
            }
        }

        return true;
    }
}
