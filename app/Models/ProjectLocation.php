<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * ProjectLocation Model
 * 
 * Represents a physical location where a developer project is situated.
 * Contains all location-specific data used in expose PDF generation including
 * address, nearby attractions, infrastructure, and airport information.
 * 
 * Address schema: {street?, state?, country?, postalCode?}
 * Note: City is stored at the property level, not the project location level.
 * 
 * A ProjectLocation has a 1:1 relationship with DeveloperProject - each project
 * is tied to exactly one location configuration.
 */
class ProjectLocation extends BaseModel
{
    use HasFactory, HasCompany, SoftDeletes;

    protected $fillable = [
        'company_id',
        'name',
        'description',
        'address',
        'map_url',
        'attractions',
        'infrastructure',
        'airports',
    ];

    /**
     * Cast JSON columns to arrays for easy manipulation
     */
    protected $casts = [
        'address' => 'array',        // {street?, state?, country?, postalCode?}
        'attractions' => 'array',     // [{name, content[], images: {primary, secondary}}]
        'infrastructure' => 'array',  // [{infrastructure_id, travelTimeInMin}]
        'airports' => 'array',        // [{airport_id, travelTimeInMin}]
    ];

    /**
     * Get the developer project that uses this location.
     * 
     * While the schema allows multiple projects to reference a location,
     * the business logic enforces 1:1 by having each project select
     * or create its own location.
     */
    public function developerProject(): HasOne
    {
        return $this->hasOne(DeveloperProject::class, 'project_location_id');
    }

    /**
     * Get formatted full address string.
     * 
     * Combines address components into a readable string.
     * Filters out null/empty values before joining.
     * Note: City is not included as it's stored at the property level.
     * 
     * @return string e.g., "123 Main St, England, UK, SW1A 1AA"
     */
    public function getFullAddressAttribute(): string
    {
        $address = $this->address ?? [];
        $parts = array_filter([
            $address['street'] ?? null,
            $address['state'] ?? null,
            $address['country'] ?? null,
            $address['postalCode'] ?? null,
        ]);
        
        return implode(', ', $parts);
    }

    /**
     * Get the state from the address.
     */
    public function getStateAttribute(): ?string
    {
        return $this->address['state'] ?? null;
    }

    /**
     * Get the country from the address.
     */
    public function getCountryAttribute(): ?string
    {
        return $this->address['country'] ?? null;
    }

    /**
     * Check if this location is currently assigned to any project.
     */
    public function isInUse(): bool
    {
        return $this->developerProject()->exists();
    }

    /**
     * Convert to the LocationConfig format expected by expose templates.
     * 
     * @return array Format matching the LocationConfig TypeScript interface
     */
    public function toLocationConfig(): array
    {
        return [
            'name' => $this->name,
            'description' => $this->description ?? '',
            'address' => $this->address ?? [
                'street' => '',
                'state' => '',
                'country' => '',
                'postalCode' => '',
            ],
            'map' => $this->map_url ?? '',
            'attractions' => $this->attractions ?? [],
            'infrastructure' => $this->getExpandedInfrastructure(),
            'airports' => $this->getExpandedAirports(),
        ];
    }

    /**
     * Get infrastructure with resolved names from Infrastructure model.
     * 
     * @return array [{name, travelTimeInMin, icon}]
     */
    public function getExpandedInfrastructure(): array
    {
        $items = $this->infrastructure ?? [];
        $result = [];

        foreach ($items as $item) {
            if (isset($item['infrastructure_id'])) {
                $infrastructure = Infrastructure::find($item['infrastructure_id']);
                if ($infrastructure) {
                    $result[] = [
                        'name' => $infrastructure->name,
                        'icon' => $infrastructure->icon,
                        'travelTimeInMin' => $item['travelTimeInMin'] ?? null,
                    ];
                }
            }
        }

        return $result;
    }

    /**
     * Get airports with resolved names from Airport model.
     * 
     * @return array [{name, code, travelTimeInMin}]
     */
    public function getExpandedAirports(): array
    {
        $items = $this->airports ?? [];
        $result = [];

        foreach ($items as $item) {
            if (isset($item['airport_id'])) {
                $airport = Airport::find($item['airport_id']);
                if ($airport) {
                    $result[] = [
                        'name' => $airport->name,
                        'code' => $airport->code,
                        'travelTimeInMin' => $item['travelTimeInMin'] ?? null,
                    ];
                }
            }
        }

        return $result;
    }
}
