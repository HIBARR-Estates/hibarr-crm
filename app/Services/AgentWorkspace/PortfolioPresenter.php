<?php

namespace App\Services\AgentWorkspace;

use App\Models\DeveloperProject;
use App\Models\Property;
use App\Models\PropertyAsset;

/**
 * The slim shapes the agent Portfolio screens read: one property card, one
 * project card. Callers eager-load PROPERTY_RELATIONS / PROJECT_RELATIONS
 * first; nothing here queries.
 */
class PortfolioPresenter
{
    public const PROPERTY_RELATIONS = [
        'developerProject:id,name,developer_id,currency',
        'developerProject.developer:id,name',
        'product:id,name',
    ];

    /** The first image only: the card needs one photo, not the gallery. */
    public static function photoRelation(): array
    {
        return ['assets' => fn ($q) => $q
            ->where('asset_type', PropertyAsset::TYPE_IMAGE)
            ->orderBy('order')
            ->limit(1)];
    }

    /**
     * @return array<string, mixed>
     */
    public static function property(Property $property): array
    {
        $project = $property->relationLoaded('developerProject') ? $property->developerProject : null;
        $developer = $project && $project->relationLoaded('developer') ? $project->developer : null;
        $photo = $property->relationLoaded('assets') ? $property->assets->first() : null;

        return [
            'id' => (int) $property->id,
            'title' => $property->display_title ?: ($property->title ?: 'Property #'.$property->id),
            'project' => $project?->name,
            'developer' => $developer?->name,
            'city' => $property->city,
            'area' => $property->area,
            'bedrooms' => $property->bedrooms !== null ? (int) $property->bedrooms : null,
            'size_sqm' => $property->living_area_sqm !== null ? (float) $property->living_area_sqm : null,
            'price' => $property->price !== null ? (float) $property->price : null,
            'currency' => $property->price_currency ?: $project?->currency,
            'construction_status' => $property->construction_status,
            'status' => $property->status,
            'photo' => $photo?->url,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public static function project(DeveloperProject $project): array
    {
        $unitTypes = $project->relationLoaded('unitTypes') ? $project->unitTypes : collect();

        return [
            'id' => (int) $project->id,
            'name' => $project->name,
            'developer' => $project->relationLoaded('developer') ? $project->developer?->name : null,
            'location' => $project->relationLoaded('location') ? $project->location?->name : null,
            'construction_status' => $project->construction_status,
            'starting_price' => $project->starting_price !== null ? (float) $project->starting_price : null,
            'currency' => $project->currencyCode(),
            'completion_date' => $project->completion_date?->toDateString(),
            'unit_types' => $unitTypes->map(function ($unit) {
                $total = (int) ($unit->quantity ?? 0);
                $sold = (int) ($unit->total_sold ?? 0);

                return [
                    'id' => (int) $unit->id,
                    'label' => $unit->display_label ?? $unit->reference_code,
                    'available' => $unit->is_sold_out ? 0 : max(0, $total - $sold),
                    'total' => $total,
                ];
            })->values()->all(),
        ];
    }
}
