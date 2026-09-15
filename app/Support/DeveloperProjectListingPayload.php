<?php

namespace App\Support;

use App\Models\DeveloperProject;

/**
 * Slim Inertia/card payload for developer project listings.
 *
 * Callers should eager-load self::RELATIONS (and withCount on properties)
 * first. from() only reads what is already loaded.
 */
class DeveloperProjectListingPayload
{
    public const RELATIONS = [
        'location:id,name',
        'developer:id,name,logo_url,is_hidden',
        'thumbnail',
    ];

    /**
     * @return array<string, mixed>
     */
    public static function from(DeveloperProject $project): array
    {
        $location = $project->relationLoaded('location') ? $project->location : null;
        $developer = $project->relationLoaded('developer') ? $project->developer : null;
        $thumbnail = $project->relationLoaded('thumbnail') ? $project->thumbnail : null;

        return [
            'id' => $project->id,
            'name' => $project->name,
            'description' => $project->description,
            'project_location_id' => $project->project_location_id,
            'starting_price' => $project->starting_price,
            'completion_date' => $project->completion_date?->toDateString(),
            'total_units' => $project->total_units !== null ? (int) $project->total_units : null,
            'total_units_sold' => $project->total_units_sold !== null ? (int) $project->total_units_sold : null,
            'properties_count' => (int) ($project->properties_count ?? 0),
            'sold_properties_count' => (int) ($project->sold_properties_count ?? 0),
            'is_hidden' => (bool) $project->is_hidden,
            'location' => $location ? [
                'id' => $location->id,
                'name' => $location->name,
            ] : null,
            'developer' => $developer ? [
                'id' => $developer->id,
                'name' => $developer->name,
                'logo_url' => $developer->logo_url,
                'is_hidden' => (bool) $developer->is_hidden,
            ] : null,
            'thumbnail' => $thumbnail ? [
                'id' => $thumbnail->id,
                'url' => $thumbnail->url,
            ] : null,
        ];
    }
}
