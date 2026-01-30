<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * DeveloperProjectExposeConfig Model
 * 
 * Stores all configuration data needed to generate an expose PDF for a project.
 * Has a 1:1 relationship with DeveloperProject.
 * 
 * All complex fields are stored as JSON and cast to arrays, matching the
 * ExposeProjectConfigData TypeScript interface structure.
 * 
 * The locationDetails are derived from the project's associated ProjectLocation
 * rather than stored here, ensuring single source of truth.
 */
class DeveloperProjectExposeConfig extends Model
{
    use HasFactory;

    protected $fillable = [
        'developer_project_id',
        'logo',
        'project_overview',
        'grouped_images',
        'generic_images',
        'info_blocks',
        'monetary_evaluation',
        'contact_details',
    ];

    /**
     * Cast all JSON fields to arrays
     */
    protected $casts = [
        'logo' => 'array',               // {dark: string, light: string}
        'project_overview' => 'array',   // {city, propertyTypes[], completionDate, facilities[], propertyOverviewImage}
        'grouped_images' => 'array',     // Record<GroupedImageKey, string[]>
        'generic_images' => 'array',     // string[]
        'info_blocks' => 'array',        // Record<InfoBlockKey, {title, subTitle, content[]}>
        'monetary_evaluation' => 'array', // {cost, expectedRentalIncome, expectedCapitalGrowth}
        'contact_details' => 'array',    // {agent, phones[], emails[], websites[], addresses[]}
    ];

    /**
     * Grouped image category keys
     * These correspond to different sections in the expose PDF
     */
    const GROUPED_IMAGE_KEYS = [
        '3-block-images',
        'floor-plans',
        'site-images',
        'other-images',
    ];

    /**
     * Info block keys
     * Each key represents a specific content block in the expose
     */
    const INFO_BLOCK_KEYS = [
        'garden-serenity',
    ];

    /**
     * Allowed sections that can be updated individually
     */
    const ALLOWED_SECTIONS = [
        'logo',
        'project_overview',
        'grouped_images',
        'generic_images',
        'info_blocks',
        'monetary_evaluation',
        'contact_details',
    ];

    /**
     * Get the developer project this config belongs to.
     */
    public function developerProject(): BelongsTo
    {
        return $this->belongsTo(DeveloperProject::class);
    }

    /**
     * Get location details from the associated project's location.
     * 
     * This derives location data from the ProjectLocation model,
     * ensuring a single source of truth for location information.
     * 
     * @return array|null LocationConfig format or null if no location set
     */
    public function getLocationDetailsAttribute(): ?array
    {
        $location = $this->developerProject?->location;
        
        if (!$location) {
            return null;
        }

        return $location->toLocationConfig();
    }

    /**
     * Build full expose configuration data for PDF generation.
     * 
     * Combines all stored config data with derived location details
     * and provided client details to create the complete expose data structure.
     * 
     * @param array $clientDetails {name: string, email: string}
     * @return array Complete ExposeProjectConfigData structure
     */
    public function toExposeConfigData(array $clientDetails = []): array
    {
        return [
            'logo' => $this->logo ?? ['dark' => '', 'light' => ''],
            'projectOverview' => $this->project_overview ?? [
                'city' => '',
                'propertyTypes' => [],
                'completionDate' => '',
                'facilities' => [],
                'propertyOverviewImage' => '',
            ],
            'groupedImages' => $this->grouped_images ?? [
                '3-block-images' => [],
                'floor-plans' => [],
                'site-images' => [],
                'other-images' => [],
            ],
            'genericImages' => $this->generic_images ?? [],
            'infoBlocks' => $this->info_blocks ?? [
                'garden-serenity' => [
                    'title' => '',
                    'subTitle' => '',
                    'content' => [],
                ],
            ],
            'monetaryEvaluation' => $this->monetary_evaluation ?? [
                'cost' => [
                    'properties' => [],
                    'additionalCosts' => [],
                    'totalCost' => 0,
                ],
                'expectedRentalIncome' => [
                    'properties' => [],
                    'deductibles' => [],
                    'totalIncome' => 0,
                ],
                'expectedCapitalGrowth' => [],
            ],
            'locationDetails' => $this->location_details ?? [
                'name' => '',
                'description' => '',
                'address' => [
                    'street' => '',
                    'city' => '',
                    'state' => '',
                    'country' => '',
                    'postalCode' => '',
                ],
                'map' => '',
                'attractions' => [],
                'infrastructure' => [],
                'airports' => [],
            ],
            'contactDetails' => $this->contact_details ?? [
                'agent' => [
                    'name' => '',
                    'position' => '',
                ],
                'phones' => [],
                'emails' => [],
                'websites' => [],
                'addresses' => [],
            ],
            'clientDetails' => array_merge([
                'name' => '',
                'email' => '',
            ], $clientDetails),
        ];
    }

    /**
     * Update a specific section of the config.
     * 
     * @param string $section Section key (must be in ALLOWED_SECTIONS)
     * @param mixed $data Data to store in the section
     * @return bool Whether the update was successful
     */
    public function updateSection(string $section, $data): bool
    {
        if (!in_array($section, self::ALLOWED_SECTIONS)) {
            return false;
        }

        $this->{$section} = $data;
        return $this->save();
    }

    /**
     * Check if the config has minimum required data for PDF generation.
     * 
     * @return array{valid: bool, missing: string[]}
     */
    public function validateForExport(): array
    {
        $missing = [];

        if (empty($this->logo['dark']) && empty($this->logo['light'])) {
            $missing[] = 'logo';
        }

        if (empty($this->project_overview['city'])) {
            $missing[] = 'project_overview.city';
        }

        if (empty($this->contact_details['agent']['name'])) {
            $missing[] = 'contact_details.agent';
        }

        if (!$this->location_details) {
            $missing[] = 'location (not assigned to project)';
        }

        return [
            'valid' => empty($missing),
            'missing' => $missing,
        ];
    }
}
