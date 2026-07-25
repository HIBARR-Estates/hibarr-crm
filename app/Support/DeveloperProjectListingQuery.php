<?php

namespace App\Support;

use Illuminate\Database\Eloquent\Builder;

/**
 * Shared filter/sort application for developer project listings (web + public API).
 */
class DeveloperProjectListingQuery
{
    /**
     * Apply listing filters and sort to a developer_projects query.
     *
     * @param  Builder<\App\Models\DeveloperProject>  $query
     * @param  array<string, mixed>  $filters  Keys: search, city, area, location_id, developer_id,
     *                                         construction_status, primary_category, payment_plan_duration,
     *                                         price_min, price_max, sort
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
            if (!empty($filters['city'])) {
                $city = strtolower(trim((string) $filters['city']));
                $area = isset($filters['area']) && $filters['area'] !== '' && $filters['area'] !== null
                    ? strtolower(trim((string) $filters['area']))
                    : null;

                $query->whereHas('location', function ($q) use ($city, $area) {
                    $q->whereRaw('LOWER(TRIM(COALESCE(city, ""))) = ?', [$city]);

                    if ($area !== null) {
                        $q->whereRaw('LOWER(TRIM(COALESCE(area, ""))) = ?', [$area]);
                    }
                });
            }
        } elseif (!empty($filters['location_id'])) {
            $query->where('project_location_id', $filters['location_id']);
        }

        if (!empty($filters['developer_id'])) {
            $query->where('developer_id', $filters['developer_id']);
        }

        if (!empty($filters['construction_status'])) {
            $query->where('construction_status', $filters['construction_status']);
        }

        if (!empty($filters['primary_category'])) {
            $query->whereJsonContains('primary_categories', $filters['primary_category']);
        }

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

        if (isset($filters['price_min']) && $filters['price_min'] !== '' && $filters['price_min'] !== null) {
            $query->where('starting_price', '>=', (float) $filters['price_min']);
        }
        if (isset($filters['price_max']) && $filters['price_max'] !== '' && $filters['price_max'] !== null) {
            $query->where('starting_price', '<=', (float) $filters['price_max']);
        }

        self::applySort($query, (string) ($filters['sort'] ?? 'newest'));

        return $query;
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
