<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
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
 * A ProjectLocation can be shared by multiple DeveloperProjects when they
 * represent the same normalized city+area.
 */
class ProjectLocation extends BaseModel
{
    use HasFactory, HasCompany, SoftDeletes;

    // Override the parent's hidden fields to show timestamps (ApiModel hides
    // created_at/updated_at by default; see Property.php for the same fix).
    protected $hidden = ['pivot'];

    protected $fillable = [
        'company_id',
        'name',
        'description',
        'city',
        'area',
        'address',
        'map_url',
        'image_url',
        'latitude',
        'longitude',
        'attractions',
        'infrastructure',
        'airports',
    ];

    /**
     * Cast JSON columns to arrays for easy manipulation
     */
    protected $casts = [
        'address' => 'array',        // {street?, state?, country?, postalCode?}
        'attractions' => 'array',     // [{name, content: string[] (HTML), images: {primary, secondary}}]
        'infrastructure' => 'array',  // [{infrastructure_id, travelTimeInMin}]
        'airports' => 'array',        // [{airport_id, travelTimeInMin}]
    ];

    /**
     * Get all developer projects that use this location.
     */
    public function developerProjects(): HasMany
    {
        return $this->hasMany(DeveloperProject::class, 'project_location_id');
    }

    /**
     * Backward-compatible singular relation accessor.
     */
    public function developerProject(): HasOne
    {
        return $this->hasOne(DeveloperProject::class, 'project_location_id');
    }

    /**
     * Properties that directly reference this location.
     */
    public function properties(): HasMany
    {
        return $this->hasMany(Property::class, 'project_location_id');
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
        return $this->developerProjects()->exists() || $this->properties()->exists();
    }

    /**
     * Normalize attractions for expose PDF rendering.
     *
     * @return array<int, array{name: string, description: string, primary_image_url: ?string, secondary_image_url: ?string}>
     */
    public function getFormattedAttractionsForExpose(): array
    {
        $result = [];

        foreach ($this->attractions ?? [] as $item) {
            $name = trim((string) ($item['name'] ?? ''));
            if ($name === '') {
                continue;
            }

            $content = $item['content'] ?? [];
            if (is_string($content)) {
                $description = $content;
            } elseif (is_array($content)) {
                $description = implode('', array_filter($content, fn ($part) => is_string($part) && trim($part) !== ''));
            } else {
                $description = '';
            }

            $images = is_array($item['images'] ?? null) ? $item['images'] : [];

            $result[] = [
                'name' => $name,
                'description' => $description,
                'primary_image_url' => $images['primary'] ?? null,
                'secondary_image_url' => $images['secondary'] ?? null,
            ];
        }

        return $result;
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
            'image' => $this->image_url ?? '',
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
     * @return array [{name, travelTimeInMin, icon, image}]
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
                        'image' => $item['image'] ?? null,
                    ];
                    continue;
                }
            }

            // Support freeform infrastructure entries saved without a lookup id.
            if (!empty($item['name'])) {
                $result[] = [
                    'name' => $item['name'],
                    'icon' => null,
                    'travelTimeInMin' => $item['travelTimeInMin'] ?? null,
                    'image' => $item['image'] ?? null,
                ];
            }
        }

        return $result;
    }

    /**
     * Get airports with resolved names from Airport model.
     * 
     * @return array [{name, code, travelTimeInMin, image}]
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
                        'image' => !empty($item['image'])
                            ? $item['image']
                            : ($airport->image_url ?? null),
                    ];
                    continue;
                }
            }

            // Support freeform airport entries saved without a lookup id.
            if (!empty($item['name'])) {
                $result[] = [
                    'name' => $item['name'],
                    'code' => $item['code'] ?? null,
                    'travelTimeInMin' => $item['travelTimeInMin'] ?? null,
                    'image' => $item['image'] ?? null,
                ];
            }
        }

        return $result;
    }
}
