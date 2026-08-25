<?php

namespace App\Support;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Shared filter/sort application for developer project listings (web + public API).
 */
class DeveloperProjectListingQuery
{
    /**
     * Normalize a comma-joined string or array into a plain string array.
     * Mirrors LeadService::toValueArray() — the wire format for a multiselect
     * filter is either a real array (JSON API) or a comma-joined string
     * (FilterContext's URL query params).
     *
     * @return array<int, string>
     */
    private static function toValueArray(mixed $value): array
    {
        if (is_array($value)) {
            return array_values(array_filter(array_map('strval', $value), fn ($v) => $v !== ''));
        }

        if ($value === null || $value === '') {
            return [];
        }

        return array_values(array_filter(array_map('trim', explode(',', (string) $value)), fn ($v) => $v !== ''));
    }

    /**
     * Apply listing filters and sort to a developer_projects query.
     *
     * @param  Builder<\App\Models\DeveloperProject>  $query
     * @param  array<string, mixed>  $filters  Keys: search, city, area, location_id, developer_id,
     *                                         construction_status, primary_category, title_deed_type,
     *                                         unit_types, completion_start, completion_end,
     *                                         min_number_of_phases, max_number_of_phases,
     *                                         min_total_units, max_total_units, payment_plan_duration,
     *                                         min_payment_plan_duration, max_payment_plan_duration,
     *                                         downpayment_type, rental_guarantee, is_hidden, facilities,
     *                                         price_min, price_max, min_starting_price, max_starting_price, sort
     * @param  bool  $filtersModalEnabled  When true, use city/area location filters; otherwise location_id
     * @return Builder<\App\Models\DeveloperProject>
     */
    public static function apply(Builder $query, array $filters, bool $filtersModalEnabled = true): Builder
    {
        if (!empty($filters['search'])) {
            $search = trim((string) $filters['search']);

            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%");
            });

            $query->orderByRaw("
                CASE
                    WHEN name LIKE ? THEN 2
                    WHEN description LIKE ? THEN 1
                    ELSE 0
                END DESC
            ", ["%{$search}%", "%{$search}%"]);
        }

        if ($filtersModalEnabled) {
            $cities = ! empty($filters['city'])
                ? array_map('strtolower', self::toValueArray($filters['city']))
                : [];
            $areas = ! empty($filters['area'])
                ? array_map('strtolower', self::toValueArray($filters['area']))
                : [];

            // Area must filter on its own too — the v2 workbench offers it as an
            // independent multiselect, so it cannot stay nested under city.
            if ($cities !== [] || $areas !== []) {
                $query->whereHas('location', function ($q) use ($cities, $areas) {
                    if ($cities !== []) {
                        $q->whereIn(DB::raw('LOWER(TRIM(COALESCE(city, "")))'), $cities);
                    }

                    if ($areas !== []) {
                        $q->whereIn(DB::raw('LOWER(TRIM(COALESCE(area, "")))'), $areas);
                    }
                });
            }
        } elseif (!empty($filters['location_id'])) {
            $query->where('project_location_id', $filters['location_id']);
        }

        if (!empty($filters['developer_id'])) {
            $query->whereIn('developer_id', self::toValueArray($filters['developer_id']));
        }

        if (!empty($filters['construction_status'])) {
            $query->whereIn('construction_status', self::toValueArray($filters['construction_status']));
        }

        if (!empty($filters['primary_category'])) {
            $categories = self::toValueArray($filters['primary_category']);
            $query->where(function ($q) use ($categories) {
                foreach ($categories as $category) {
                    $q->orWhereJsonContains('primary_categories', $category);
                }
            });
        }

        if (!empty($filters['title_deed_type'])) {
            $query->whereIn('title_deed_type', self::toValueArray($filters['title_deed_type']));
        }

        if (!empty($filters['unit_types'])) {
            $unitTypes = self::toValueArray($filters['unit_types']);
            $query->where(function ($q) use ($unitTypes) {
                foreach ($unitTypes as $type) {
                    $q->orWhereJsonContains('unit_types', $type);
                }
            });
        }

        if (!empty($filters['completion_start'])) {
            $query->where('completion_date', '>=', $filters['completion_start']);
        }
        if (!empty($filters['completion_end'])) {
            $query->where('completion_date', '<=', $filters['completion_end']);
        }

        self::applyIntRange($query, 'number_of_phases', $filters['min_number_of_phases'] ?? null, $filters['max_number_of_phases'] ?? null);
        self::applyIntRange($query, 'total_units', $filters['min_total_units'] ?? null, $filters['max_total_units'] ?? null);

        if (!empty($filters['downpayment_type'])) {
            $query->whereRaw(
                "JSON_UNQUOTE(JSON_EXTRACT(payment_plan, '$.downpayment_type')) = ?",
                [$filters['downpayment_type']]
            );
        }

        if (isset($filters['rental_guarantee']) && $filters['rental_guarantee'] !== '') {
            $query->where('rental_guarantee', filter_var($filters['rental_guarantee'], FILTER_VALIDATE_BOOLEAN));
        }

        if (DeveloperProjectVisibility::enabled() && isset($filters['is_hidden']) && $filters['is_hidden'] !== '') {
            $query->where('is_hidden', filter_var($filters['is_hidden'], FILTER_VALIDATE_BOOLEAN));
        }

        if (!empty($filters['facilities'])) {
            $slugs = self::toValueArray($filters['facilities']);
            $query->where(function ($q) use ($slugs) {
                foreach ($slugs as $slug) {
                    $q->orWhereJsonContains('facilities', $slug)
                        ->orWhereHas('properties', function ($pq) use ($slug) {
                            $pq->where(function ($ppq) use ($slug) {
                                $ppq->whereJsonContains('exterior_features', $slug)
                                    ->orWhereJsonContains('interior_features', $slug);
                            });
                        });
                }
            });
        }

        // Legacy exact-match — the pre-v2 UI sends a single bare value.
        if (isset($filters['payment_plan_duration']) && $filters['payment_plan_duration'] !== '' && $filters['payment_plan_duration'] !== null) {
            $durationMonths = filter_var($filters['payment_plan_duration'], FILTER_VALIDATE_INT, [
                'options' => ['min_range' => 0],
            ]);

            if ($durationMonths !== false) {
                $query->whereRaw(
                    "CAST(JSON_UNQUOTE(JSON_EXTRACT(payment_plan, '$.period_months')) AS UNSIGNED) = ?",
                    [$durationMonths]
                );
            }
        }

        // v2 range — "set value as a minimum" is just leaving max empty.
        if (isset($filters['min_payment_plan_duration']) && $filters['min_payment_plan_duration'] !== '') {
            $query->whereRaw(
                "CAST(JSON_UNQUOTE(JSON_EXTRACT(payment_plan, '$.period_months')) AS UNSIGNED) >= ?",
                [(int) $filters['min_payment_plan_duration']]
            );
        }
        if (isset($filters['max_payment_plan_duration']) && $filters['max_payment_plan_duration'] !== '') {
            $query->whereRaw(
                "CAST(JSON_UNQUOTE(JSON_EXTRACT(payment_plan, '$.period_months')) AS UNSIGNED) <= ?",
                [(int) $filters['max_payment_plan_duration']]
            );
        }

        if (isset($filters['price_min']) && $filters['price_min'] !== '' && $filters['price_min'] !== null) {
            $query->where('starting_price', '>=', (float) $filters['price_min']);
        }
        if (isset($filters['price_max']) && $filters['price_max'] !== '' && $filters['price_max'] !== null) {
            $query->where('starting_price', '<=', (float) $filters['price_max']);
        }
        self::applyDecimalRange($query, 'starting_price', $filters['min_starting_price'] ?? null, $filters['max_starting_price'] ?? null);

        self::applySort($query, (string) ($filters['sort'] ?? 'newest'));

        return $query;
    }

    /**
     * @param  Builder<\App\Models\DeveloperProject>  $query
     */
    private static function applyIntRange(Builder $query, string $column, mixed $min, mixed $max): void
    {
        if ($min !== null && $min !== '') {
            $query->where($column, '>=', (int) $min);
        }
        if ($max !== null && $max !== '') {
            $query->where($column, '<=', (int) $max);
        }
    }

    /**
     * @param  Builder<\App\Models\DeveloperProject>  $query
     */
    private static function applyDecimalRange(Builder $query, string $column, mixed $min, mixed $max): void
    {
        if ($min !== null && $min !== '') {
            $query->where($column, '>=', (float) $min);
        }
        if ($max !== null && $max !== '') {
            $query->where($column, '<=', (float) $max);
        }
    }

    /**
     * @param  Builder<\App\Models\DeveloperProject>  $query
     */
    private static function applySort(Builder $query, string $sort): void
    {
        switch ($sort) {
            case 'oldest':
                $query->orderBy('created_at', 'asc');
                break;
            case 'name_asc':
                $query->orderBy('name', 'asc');
                break;
            case 'name_desc':
                $query->orderBy('name', 'desc');
                break;
            case 'properties_desc':
                $query->orderByDesc('properties_count');
                break;
            case 'cheapest':
                $query->orderBy('starting_price', 'asc');
                break;
            case 'most_expensive':
                $query->orderBy('starting_price', 'desc');
                break;
            default: // newest
                $query->orderBy('created_at', 'desc');
                break;
        }
    }
}
