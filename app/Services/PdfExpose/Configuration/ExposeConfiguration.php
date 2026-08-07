<?php

namespace App\Services\PdfExpose\Configuration;

use App\Models\Company;
use App\Models\CompanyAddress;
use App\Models\CompanyExposeConfiguration;
use App\Models\DeveloperProject;
use App\Models\DeveloperProjectUnitType;
use App\Models\ProjectFacility;
use App\Models\PropertyCity;
use App\Models\User;
use Illuminate\Contracts\Support\Arrayable;

class ExposeConfiguration implements Arrayable
{
    public function __construct(
        public readonly string $entityType,        // 'property', 'developer_project', etc.
        public readonly int $entityId,
        public readonly string $layout,            // 'vertical', 'horizontal'
        public readonly array $sections,           // Sections to include
        public readonly array $data,               // Actual data to populate
        public readonly array $options = [],       // Additional options
    ) {}

    public static function fromProperty($property, string $layout, array $clientData = [], array $sections = [], ?User $generatedBy = null, ?int $companyId = null): self
    {
        $property->loadMissing(['projectLocation', 'developerProject.location', 'developerProject.assets', 'assets']);

        $agent = self::resolveGeneratingUser($generatedBy);
        $company = self::resolveGeneratingCompany($agent, $companyId ?? $property->company_id);
        $project = $property->developerProject;
        $projectLocation = $property->projectLocation ?? $project?->location;
        $locationInfrastructure = $projectLocation?->getExpandedInfrastructure() ?? [];
        $locationAirports = $projectLocation?->getExpandedAirports() ?? [];
        $locationAttractions = $projectLocation?->getFormattedAttractionsForExpose() ?? [];
        $globalExposeConfig = self::resolveGlobalExposeConfiguration($property->company_id ?? $company?->id);
        
        $availableTags = ['hero', 'cover', 'area', 'exterior', 'interior', 'floor-plan', 'facilities', 'footer', 'gallery'];
        $assetsByTag = self::groupImageAssetsByTags($property->assets, $availableTags);

        $facilityPayload = self::resolveFacilityPayload(
            $project?->facilities ?? [],
            $project?->company_id ?? $property->company_id,
            $project
        );

        if (!empty($facilityPayload['facility_gallery_images'])) {
            $assetsByTag['facilities'] = $facilityPayload['facility_gallery_images'];
        }

        $unitStyleList = [];
        if (is_array($property->unit_style)) {
            $unitStyleList = array_values(array_map(
                fn ($style) => is_string($style) ? ucfirst(str_replace('_', ' ', $style)) : (string) $style,
                $property->unit_style
            ));
        } elseif (!empty($property->unit_style)) {
            $unitStyleList = array_values(array_filter(array_map('trim', explode('/', (string) $property->unit_style))));
        }

        return new self(
            entityType: 'property',
            entityId: $property->id,
            layout: $layout,
            sections: $sections ?: ['header', 'images', 'details', 'description', 'location', 'contact'],
            data: [
                // Basic property info
                'title' => $property->title ?? $property->display_title ?? $property->reference_code,
                'display_label' => $property->display_title ?? $property->title ?? null,
                'reference_code' => $property->reference_code,
                'price' => number_format($property->price ?? 0, 2) . ' €',
                'raw_price' => $property->price,
                
                // Location
                'city' => $property->city,
                'area' => $property->area, // District/area name
                'address' => $property->address ?? $property->city,
                'latitude' => $property->latitude,
                'longitude' => $property->longitude,
                
                // Size & rooms
                'living_area_sqm' => $property->living_area_sqm,
                'gross_sqm' => $property->gross_sqm,
                'land_size' => $property->land_size,
                'terrace_area_sqm' => $property->terrace_area_sqm,
                'bedrooms' => $property->bedrooms,
                'bathrooms' => $property->bathrooms,
                'rooms' => $property->rooms,
                'living_room' => $property->living_room,
                'floor_number' => $property->floor_number,
                'floors_in_building' => $property->floors_in_building,
                'balcony_count' => $property->balcony_count,
                'balcony_net_sqm' => $property->balcony_net_sqm,
                
                // Property classification
                'property_type' => $property->property_type,
                'primary_category' => $property->primary_category,
                'unit_style' => is_array($property->unit_style) ? implode(' / ', array_map('ucfirst', $property->unit_style)) : ($property->unit_style ?? null),
                'unit_style_list' => $unitStyleList,
                'sale_type' => $property->sale_type,
                'status' => $property->status,
                'block_name' => $property->block_name,
                'unit_number' => $property->unit_number,
                
                // Building info
                'building_age' => $property->building_age,
                'completion_date' => $property->completion_date?->format('Y'),
                'construction_status' => $property->construction_status,
                'furniture_status' => $property->furniture_status,
                'heating_type' => $property->heating_type,
                'title_deed_type' => $property->title_deed_type,
                
                // Content
                'description' => $property->description,
                'created_at' => $property->created_at->format('M d, Y'),
                
                // Features (combined for backward compatibility)
                'features' => array_merge(
                    $property->exterior_features ?? [],
                    $property->interior_features ?? [],
                    $property->location_features ?? []
                ),
                
                // Feature arrays (separate)
                'exterior_features' => !empty($facilityPayload['facility_labels'])
                    ? $facilityPayload['facility_labels']
                    : ($property->exterior_features ?? []),
                'interior_features' => $property->interior_features ?? [],
                'location_features' => $property->location_features ?? [],
                'outside_features' => $property->outside_features ?? [],
                'inside_features' => $property->inside_features ?? [],
                'view_types' => $property->view_types ?? [],

                // Project facilities (parity with unit-type / project expose)
                'facilities' => $facilityPayload['facility_slugs'],
                'facility_labels' => $facilityPayload['facility_labels'],
                'facility_images_by_slug' => $facilityPayload['facility_images_by_slug'],
                'facility_default_images_by_slug' => $facilityPayload['facility_default_images_by_slug'],
                
                // Distances (for infrastructure page)
                'distances' => $property->distances ?? [],

                // Structured location infrastructure for PDF sections
                'location_infrastructure' => $locationInfrastructure,
                'location_airports' => $locationAirports,
                'location_attractions' => $locationAttractions,

                // Location page payload — fetch PropertyCity data if available
                'location_payload' => (function() use ($property, $company) {
                    $propertyCity = null;
                    if (!empty($property->city)) {
                        $propertyCity = PropertyCity::where('company_id', $property->company_id ?? $company?->id)
                            ->where('name', $property->city)
                            ->first();
                    }
                    return [
                        'name' => $property->area ?? $property->city ?? null,
                        'description' => $propertyCity?->description ?? null,
                        'image_url' => $propertyCity?->image_url ?? null,
                    ];
                })(),
                
                // Assets grouped by tags
                'assets' => $assetsByTag,
                
                // Agent info
                'agent' => self::buildAgentData($agent),
                
                // Company branding
                'company' => self::buildCompanyData($company),
                
                // Client personalization
                'client' => [
                    'name' => $clientData['client_name'] ?? null,
                    'email' => $clientData['client_email'] ?? null,
                ],

                // Global company expose configuration
                'expose_global_config' => $globalExposeConfig,
            ],
            options: [
                'include_qr_code' => $globalExposeConfig['qr']['enabled'],
                'watermark' => false,
            ]
        );
    }

    public static function fromDeveloperProject(DeveloperProject $project, string $layout = 'project-expose-template', array $clientData = [], ?User $generatedBy = null, ?int $companyId = null): self
    {
        $project->loadMissing(['developer', 'location', 'assets', 'unitTypes.assets']);

        $agent = self::resolveGeneratingUser($generatedBy);
        $company = self::resolveGeneratingCompany($agent, $companyId ?? $project->company_id);
        $location = $project->location;
        $locationAttractions = $location?->getFormattedAttractionsForExpose() ?? [];
        $globalExposeConfig = self::resolveGlobalExposeConfiguration($project->company_id ?? $company?->id);

        $availableTags = ['hero', 'area', 'exterior', 'interior', 'floor-plan', 'facilities', 'footer', 'gallery', 'site-plan'];
        $assetsByTag = self::groupImageAssetsByTags($project->assets, $availableTags);

        // Build unit type summaries for the project brochure
        $unitTypeSummaries = [];
        foreach ($project->unitTypes->sortBy('order') as $unitType) {
            $coverUrl = $unitType->assets
                ->filter(fn($a) => $a->asset_type === 'image' && (
                    in_array('cover', $a->tags ?? []) || in_array('hero', $a->tags ?? [])
                ))
                ->sortBy('order')
                ->first()?->url;

            $unitTypeSummaries[] = [
                'id' => $unitType->id,
                'reference_code' => $unitType->reference_code,
                'display_label' => $unitType->display_label,
                'property_type' => $unitType->property_type,
                'primary_category' => $unitType->primary_category,
                'bedrooms' => $unitType->bedrooms,
                'bathrooms' => $unitType->bathrooms,
                'living_area_sqm' => $unitType->living_area_sqm,
                'total_area_sqm' => $unitType->total_area_sqm,
                'starting_price' => $unitType->starting_price,
                'formatted_price' => $unitType->formatted_price,
                'currency_symbol' => $unitType->currency_symbol,
                'furniture_status' => $unitType->furniture_status,
                'unit_style' => is_array($unitType->unit_style) ? implode(' / ', array_map('ucfirst', $unitType->unit_style)) : ($unitType->unit_style ?? null),
                'view_types' => $unitType->view_types ?? [],
                'completion_date' => $unitType->completion_date?->format('Y') ?? $project->completion_date?->format('Y'),
                'cover_image' => $coverUrl,
                'description' => $unitType->description,
            ];
        }

        // Build distances from project distances field
        $distances = $project->distances ?? [];
        $expandedInfra = [];
        $expandedAirports = [];

        // Enrich with location infrastructure/airports if available
        if ($location) {
            $expandedInfra = $location->getExpandedInfrastructure();
            foreach ($expandedInfra as $infra) {
                $distances[] = [
                    'name' => $infra['name'],
                    'time' => $infra['travelTimeInMin'],
                    'type' => 'infrastructure',
                    'image' => $infra['image'] ?? null,
                ];
            }
            $expandedAirports = $location->getExpandedAirports();
            foreach ($expandedAirports as $airport) {
                $distances[] = [
                    'name' => $airport['name'] . ($airport['code'] ? ' (' . $airport['code'] . ')' : ''),
                    'time' => $airport['travelTimeInMin'],
                    'type' => 'airport',
                    'image' => $airport['image'] ?? null,
                ];
            }
        }

        // Resolve location details
        $city = $location?->state ?? $location?->name ?? null;
        $area = $location?->name ?? null;

        // Get facility labels and default images from DB
        $facilitySlugs = $project->facilities ?? [];
        $facilityMetaByName = ProjectFacility::where('company_id', $project->company_id)
            ->whereIn('name', $facilitySlugs)
            ->get(['name', 'label', 'image_url'])
            ->keyBy('name');

        $facilityLabels = [];
        $facilityDefaultImagesBySlug = [];
        foreach ($facilitySlugs as $facilityKey) {
            $facilityMeta = $facilityMetaByName->get($facilityKey);
            $facilityLabels[] = $facilityMeta?->label ?? ucfirst(str_replace('_', ' ', $facilityKey));
            $facilityDefaultImagesBySlug[$facilityKey] = $facilityMeta?->image_url;
        }

        // Build deterministic facility image mapping via namespaced tags (facilities:<slug>).
        // This avoids label/image drift when counts differ.
        $facilityImagesBySlug = [];
        foreach ($facilitySlugs as $facilityKey) {
            $facilityImagesBySlug[$facilityKey] = [];
        }

        $genericFacilityImages = [];
        $projectImageAssets = $project->assets()
            ->where('asset_type', 'image')
            ->orderBy('order')
            ->orderBy('created_at', 'desc')
            ->get();

        foreach ($projectImageAssets as $asset) {
            $url = $asset->url;
            if (empty($url)) {
                continue;
            }

            $tags = $asset->tags ?? [];
            if (in_array('facilities', $tags, true)) {
                $genericFacilityImages[] = $url;
            }

            foreach ($tags as $tag) {
                if (!is_string($tag) || !str_starts_with($tag, 'facilities:')) {
                    continue;
                }

                $slug = substr($tag, strlen('facilities:'));
                if ($slug === '' || !array_key_exists($slug, $facilityImagesBySlug)) {
                    continue;
                }

                $facilityImagesBySlug[$slug][] = $url;
            }
        }

        // Build ordered facility gallery list by facility slug order.
        // Fallback order: tagged image -> facility default image -> generic facilities image.
        $facilityGalleryImages = [];
        $remainingGenericFacilityImages = $genericFacilityImages;

        foreach ($facilitySlugs as $facilityKey) {
            if (!empty($facilityImagesBySlug[$facilityKey])) {
                $facilityGalleryImages[] = $facilityImagesBySlug[$facilityKey][0];
                continue;
            }

            $defaultImage = $facilityDefaultImagesBySlug[$facilityKey] ?? null;
            if (!empty($defaultImage)) {
                $facilityGalleryImages[] = $defaultImage;
                continue;
            }

            while (!empty($remainingGenericFacilityImages)) {
                $genericImage = array_shift($remainingGenericFacilityImages);
                if (!in_array($genericImage, $facilityGalleryImages, true)) {
                    $facilityGalleryImages[] = $genericImage;
                    break;
                }
            }
        }

        // Backward-compatible fallback: append remaining generic facilities images.
        foreach ($remainingGenericFacilityImages as $url) {
            if (!in_array($url, $facilityGalleryImages, true)) {
                $facilityGalleryImages[] = $url;
            }
        }

        if (!empty($facilityGalleryImages)) {
            $assetsByTag['facilities'] = $facilityGalleryImages;
        }

        return new self(
            entityType: 'property',
            entityId: $project->id,
            layout: $layout,
            sections: ['header', 'overview', 'unit_types', 'facilities', 'distances', 'contact'],
            data: [
                // Project info
                'title' => $project->name,
                'reference_code' => $project->reference_code,
                'price' => $project->starting_price ? number_format($project->starting_price, 0) . ' £' : null,
                'raw_price' => $project->starting_price,

                // Location
                'city' => $city,
                'area' => $area,
                'address' => $location?->full_address ?? null,

                // Project specs
                'property_type' => is_array($project->unit_types) ? implode(', ', $project->unit_types) : null,
                'primary_category' => is_array($project->primary_categories) ? implode(', ', $project->primary_categories) : null,
                'construction_status' => $project->construction_status ? (DeveloperProject::CONSTRUCTION_STATUS_LABELS[$project->construction_status] ?? ucfirst(str_replace('_', ' ', $project->construction_status))) : null,
                'completion_date' => $project->completion_date?->format('Y'),
                'furniture_status' => $project->furniture_package ? (DeveloperProject::FURNITURE_PACKAGE_LABELS[$project->furniture_package] ?? ucfirst(str_replace('_', ' ', $project->furniture_package))) : null,
                'title_deed_type' => $project->title_deed_type ? (DeveloperProject::TITLE_DEED_TYPE_LABELS[$project->title_deed_type] ?? $project->title_deed_type) : null,
                'number_of_units' => $project->number_of_units,
                'number_of_blocks' => $project->number_of_blocks,
                'number_of_phases' => $project->number_of_phases,
                'project_total_area_sqm' => $project->project_total_area_sqm,
                'rental_guarantee' => $project->rental_guarantee,
                'payment_plan' => $project->payment_plan,

                // Content
                'description' => $project->description,
                'developer_name' => $project->developer?->name,
                'developer_logo' => $project->developer?->logo_url,

                // Facilities
                'facilities' => $project->facilities ?? [],
                'facility_labels' => $facilityLabels,
                'facility_images_by_slug' => $facilityImagesBySlug,
                'facility_default_images_by_slug' => $facilityDefaultImagesBySlug,
                'exterior_features' => $facilityLabels, // For template compatibility (facilities gallery uses exterior_features)

                // Unit type summaries
                'unit_types' => $unitTypeSummaries,

                // Distances
                'distances' => $distances,

                // Structured location infrastructure for PDF sections
                'location_infrastructure' => $expandedInfra ?? [],
                'location_airports' => $expandedAirports ?? [],
                'location_attractions' => $locationAttractions,

                // Assets grouped by tags
                'assets' => $assetsByTag,

                // Agent info
                'agent' => self::buildAgentData($agent),

                // Company branding
                'company' => self::buildCompanyData($company),

                // Client personalization
                'client' => [
                    'name' => $clientData['client_name'] ?? null,
                    'email' => $clientData['client_email'] ?? null,
                ],

                // Global company expose configuration
                'expose_global_config' => $globalExposeConfig,

                // Sale type for template compatibility
                'sale_type' => 'For Sale',
            ],
            options: [
                'include_qr_code' => $globalExposeConfig['qr']['enabled'],
                'watermark' => false,
            ]
        );
    }

    /**
     * Create configuration for a unit type expose.
     *
     * Masquerades as a property expose so it reuses the property expose template.
     * Missing data (city, distances, construction_status, some asset tags) is
     * inherited from the parent DeveloperProject + ProjectLocation.
     */
    public static function fromUnitType(DeveloperProjectUnitType $unitType, string $layout = 'expose-template', array $clientData = [], ?User $generatedBy = null, ?int $companyId = null): self
    {
        $unitType->loadMissing(['project.developer', 'project.location', 'project.assets', 'assets']);

        $project = $unitType->project;
        $location = $project?->location;
        $agent = self::resolveGeneratingUser($generatedBy);
        $company = self::resolveGeneratingCompany($agent, $companyId ?? $project?->company_id);
        $globalExposeConfig = self::resolveGlobalExposeConfiguration($project?->company_id ?? $company?->id);

        $availableTags = ['hero', 'cover', 'area', 'exterior', 'interior', 'floor-plan', 'facilities', 'footer', 'gallery'];
        $unitAssetsByTag = self::groupImageAssetsByTags($unitType->assets, $availableTags);
        $projectAssetsByTag = $project
            ? self::groupImageAssetsByTags($project->assets, $availableTags)
            : array_fill_keys($availableTags, []);

        $assetsByTag = self::mergeAssetTagsWithFallback($unitAssetsByTag, $projectAssetsByTag, $availableTags);

        if (empty($assetsByTag['hero']) && !empty($assetsByTag['cover'])) {
            $assetsByTag['hero'] = $assetsByTag['cover'];
        }

        // Resolve location-derived fields from ProjectLocation
        $city = $location?->state ?? $location?->name ?? null;
        $area = $location?->name ?? null;

        // Resolve project facilities and image mapping from project assets tags (facilities:<slug>)
        $facilitySlugs = $project?->facilities ?? [];
        $facilityMetaByName = collect();
        if ($project && !empty($facilitySlugs)) {
            $facilityMetaByName = ProjectFacility::where('company_id', $project->company_id)
                ->whereIn('name', $facilitySlugs)
                ->get(['name', 'label', 'image_url'])
                ->keyBy('name');
        }

        $facilityLabels = [];
        $facilityDefaultImagesBySlug = [];
        foreach ($facilitySlugs as $facilityKey) {
            $facilityMeta = $facilityMetaByName->get($facilityKey);
            $facilityLabels[] = $facilityMeta?->label ?? ucfirst(str_replace('_', ' ', $facilityKey));
            $facilityDefaultImagesBySlug[$facilityKey] = $facilityMeta?->image_url;
        }

        $facilityImagesBySlug = [];
        foreach ($facilitySlugs as $facilityKey) {
            $facilityImagesBySlug[$facilityKey] = [];
        }

        $genericFacilityImages = [];
        if ($project) {
            $projectImageAssets = $project->assets()
                ->where('asset_type', 'image')
                ->orderBy('order')
                ->orderBy('created_at', 'desc')
                ->get();

            foreach ($projectImageAssets as $asset) {
                $url = $asset->url;
                if (empty($url)) {
                    continue;
                }

                $tags = $asset->tags ?? [];
                if (in_array('facilities', $tags, true)) {
                    $genericFacilityImages[] = $url;
                }

                foreach ($tags as $tag) {
                    if (!is_string($tag) || !str_starts_with($tag, 'facilities:')) {
                        continue;
                    }

                    $slug = substr($tag, strlen('facilities:'));
                    if ($slug === '' || !array_key_exists($slug, $facilityImagesBySlug)) {
                        continue;
                    }

                    $facilityImagesBySlug[$slug][] = $url;
                }
            }
        }

        $facilityGalleryImages = [];
        $remainingGenericFacilityImages = $genericFacilityImages;
        foreach ($facilitySlugs as $facilityKey) {
            if (!empty($facilityImagesBySlug[$facilityKey])) {
                $facilityGalleryImages[] = $facilityImagesBySlug[$facilityKey][0];
                continue;
            }

            $defaultImage = $facilityDefaultImagesBySlug[$facilityKey] ?? null;
            if (!empty($defaultImage)) {
                $facilityGalleryImages[] = $defaultImage;
                continue;
            }

            while (!empty($remainingGenericFacilityImages)) {
                $genericImage = array_shift($remainingGenericFacilityImages);
                if (!in_array($genericImage, $facilityGalleryImages, true)) {
                    $facilityGalleryImages[] = $genericImage;
                    break;
                }
            }
        }

        foreach ($remainingGenericFacilityImages as $url) {
            if (!in_array($url, $facilityGalleryImages, true)) {
                $facilityGalleryImages[] = $url;
            }
        }

        if (!empty($facilityGalleryImages)) {
            $assetsByTag['facilities'] = $facilityGalleryImages;
        }

        // Build distances from project + location infrastructure/airports
        $distances = $project?->distances ?? [];
        $expandedInfra = [];
        $expandedAirports = [];
        $locationAttractions = $location?->getFormattedAttractionsForExpose() ?? [];
        $hasUnitTypeDescription = filled($unitType->description);
        $hasProjectDescription = filled($project?->description);
        if ($location) {
            $expandedInfra = $location->getExpandedInfrastructure();
            foreach ($expandedInfra as $infra) {
                $distances[] = [
                    'name' => $infra['name'],
                    'time' => $infra['travelTimeInMin'],
                    'type' => 'infrastructure',
                    'image' => $infra['image'] ?? null,
                ];
            }
            $expandedAirports = $location->getExpandedAirports();
            foreach ($expandedAirports as $airport) {
                $distances[] = [
                    'name' => $airport['name'] . ($airport['code'] ? ' (' . $airport['code'] . ')' : ''),
                    'time' => $airport['travelTimeInMin'],
                    'type' => 'airport',
                    'image' => $airport['image'] ?? null,
                ];
            }
        }

        // Map unit type property_type to human label
        $propertyTypeLabel = $unitType->property_type;
        $allPropertyTypes = array_merge(
            DeveloperProjectUnitType::RESIDENTIAL_PROPERTY_TYPES,
            DeveloperProjectUnitType::COMMERCIAL_PROPERTY_TYPES
        );
        if (isset($allPropertyTypes[$unitType->property_type])) {
            $propertyTypeLabel = $allPropertyTypes[$unitType->property_type];
        }

        // Map furniture status to label
        $furnitureLabel = $unitType->furniture_status;
        if (isset(DeveloperProjectUnitType::FURNITURE_STATUSES[$unitType->furniture_status])) {
            $furnitureLabel = DeveloperProjectUnitType::FURNITURE_STATUSES[$unitType->furniture_status];
        }

        // Map construction status from project
        $constructionStatus = $project?->construction_status;
        $constructionStatusLabel = $constructionStatus;
        if ($constructionStatus && isset(DeveloperProject::CONSTRUCTION_STATUS_LABELS[$constructionStatus])) {
            $constructionStatusLabel = DeveloperProject::CONSTRUCTION_STATUS_LABELS[$constructionStatus];
        }

        // Map outside features → exterior_features with labels
        $outsideFeatureLabels = [];
        foreach ($unitType->outside_features ?? [] as $key) {
            $outsideFeatureLabels[] = DeveloperProjectUnitType::OUTSIDE_FEATURES[$key] ?? ucfirst(str_replace('_', ' ', $key));
        }

        // Map inside features → interior_features with labels
        $insideFeatureLabels = [];
        foreach ($unitType->inside_features ?? [] as $key) {
            $insideFeatureLabels[] = DeveloperProjectUnitType::INSIDE_FEATURES[$key] ?? ucfirst(str_replace('_', ' ', $key));
        }

        // Map view types to labels
        $viewTypeLabels = [];
        foreach ($unitType->view_types ?? [] as $key) {
            $viewTypeLabels[] = DeveloperProjectUnitType::VIEW_TYPES[$key] ?? ucfirst(str_replace('_', ' ', $key));
        }

        // Format price with currency symbol
        $formattedPrice = null;
        if ($unitType->starting_price) {
            $formattedPrice = $unitType->currency_symbol . number_format((float) $unitType->starting_price, 0);
        }

        $unitStyleList = [];
        foreach ($unitType->unit_style ?? [] as $styleKey) {
            $label = DeveloperProjectUnitType::UNIT_STYLES[$styleKey] ?? ucfirst(str_replace('_', ' ', (string) $styleKey));
            $unitStyleList[] = $label;
        }

        return new self(
            entityType: 'property', // Masquerade as property to reuse template path
            entityId: $unitType->id,
            layout: $layout,
            sections: ['header', 'images', 'details', 'description', 'location', 'contact'],
            data: [
                // Basic info — mapped from unit type + project
                'title' => $unitType->display_label . ($project ? ' — ' . $project->name : ''),
                'display_label' => $unitType->display_label,
                'reference_code' => $unitType->reference_code,
                'price' => $formattedPrice,
                'raw_price' => $unitType->starting_price,

                // Location — inherited from project location
                'city' => $city,
                'area' => $area,
                'address' => $location?->full_address ?? $city,
                'latitude' => null,
                'longitude' => null,

                // Size & rooms
                'living_area_sqm' => $unitType->living_area_sqm,
                'gross_sqm' => $unitType->total_area_sqm,
                'land_size' => $unitType->plot_size_sqm,
                'terrace_area_sqm' => $unitType->terrace_balcony_sqm,
                'bedrooms' => $unitType->bedrooms,
                'bathrooms' => $unitType->bathrooms,
                'rooms' => null, // Not available on unit types
                'living_room' => null, // Not available on unit types
                'floor_number' => $unitType->floor,
                'floors_in_building' => $unitType->floors_in_building,
                'balcony_count' => null, // Not available — template handles null
                'balcony_net_sqm' => $unitType->terrace_balcony_sqm,

                // Property classification
                'property_type' => $propertyTypeLabel,
                'primary_category' => $unitType->primary_category,
                'unit_style' => is_array($unitType->unit_style) ? implode(' / ', array_map('ucfirst', $unitType->unit_style)) : ($unitType->unit_style ?? null),
                'sale_type' => 'For Sale', // Default for unit types
                'status' => null,
                'block_name' => null, // Not on unit types
                'unit_number' => null, // Not on unit types

                // Building info
                'building_age' => null, // Not applicable to new construction
                'completion_date' => $unitType->completion_date?->format('Y') ?? $project?->completion_date?->format('Y'),
                'construction_status' => $constructionStatusLabel,
                'furniture_status' => $furnitureLabel,
                'heating_type' => null,
                'title_deed_type' => $project?->title_deed_type ? (DeveloperProject::TITLE_DEED_TYPE_LABELS[$project->title_deed_type] ?? $project->title_deed_type) : null,

                // Content
                'description' => $unitType->description ?? $project?->description,
                'unit_type_description_provided' => $hasUnitTypeDescription,
                'unit_type_description_source' => $hasUnitTypeDescription
                    ? 'unit_type'
                    : ($hasProjectDescription ? 'project' : 'none'),
                'created_at' => now()->format('M d, Y'),

                // Features
                'features' => array_merge($outsideFeatureLabels, $insideFeatureLabels),
                'exterior_features' => !empty($facilityLabels) ? $facilityLabels : $outsideFeatureLabels,
                'interior_features' => $insideFeatureLabels,
                'location_features' => [],
                'outside_features' => $unitType->outside_features ?? [],
                'inside_features' => $unitType->inside_features ?? [],
                'view_types' => $viewTypeLabels,
                'facility_default_images_by_slug' => $facilityDefaultImagesBySlug,
                'unit_style_list' => $unitStyleList,

                // Project facilities for facilities page
                'facilities' => $facilitySlugs,
                'facility_labels' => $facilityLabels,
                'facility_images_by_slug' => $facilityImagesBySlug,

                // Project location page payload
                'location_payload' => [
                    'name' => $location?->name,
                    'description' => $location?->description,
                    'image_url' => $location?->image_url,
                ],

                // Distances (from project + location)
                'distances' => $distances,

                // Structured location infrastructure for PDF sections
                'location_infrastructure' => $expandedInfra ?? [],
                'location_airports' => $expandedAirports ?? [],
                'location_attractions' => $locationAttractions,

                // Assets grouped by tags
                'assets' => $assetsByTag,

                // Agent info
                'agent' => self::buildAgentData($agent),

                // Company branding
                'company' => self::buildCompanyData($company),

                // Client personalization
                'client' => [
                    'name' => $clientData['client_name'] ?? null,
                    'email' => $clientData['client_email'] ?? null,
                ],

                // Global company expose configuration
                'expose_global_config' => $globalExposeConfig,
            ],
            options: [
                'include_qr_code' => $globalExposeConfig['qr']['enabled'],
                'watermark' => false,
            ]
        );
    }

    /**
     * Create configuration for project expose with selected properties and lead info.
     *
     * @param \App\Models\DeveloperProject $project
     * @param \Illuminate\Support\Collection $properties
     * @param array $lead Lead info (either existing lead or new lead data)
     * @param \App\Models\User $generatedBy User who is generating the expose
     * @param string $layout Layout template to use
     * @return self
     */
    public static function fromProjectWithProperties($project, $properties, array $lead, $generatedBy, string $layout = 'vertical_standard'): self
    {
        $company = self::resolveGeneratingCompany($generatedBy);
        $globalExposeConfig = self::resolveGlobalExposeConfiguration($project->company_id ?? $company?->id);
        
        // Group property assets by tags
        $assetsByTag = [
            'hero' => [],
            'exterior' => [],
            'interior' => [],
            'floor-plan' => [],
            'facilities' => [],
            'gallery' => [],
        ];

        $propertiesData = [];
        foreach ($properties as $property) {
            // Collect assets from each property
            foreach (array_keys($assetsByTag) as $tag) {
                $propertyAssets = $property->assets()
                    ->where('asset_type', 'image')
                    ->whereJsonContains('tags', $tag)
                    ->orderBy('order')
                    ->orderBy('created_at', 'desc')
                    ->get()
                    ->map(fn($asset) => $asset->url)
                    ->filter()
                    ->values()
                    ->toArray();
                $assetsByTag[$tag] = array_merge($assetsByTag[$tag], $propertyAssets);
            }

            // Collect property data
            $propertiesData[] = [
                'id' => $property->id,
                'title' => $property->title,
                'price' => $property->price,
                'formatted_price' => $property->price ? number_format($property->price, 2) . ' €' : null,
                'bedrooms' => $property->bedrooms,
                'bathrooms' => $property->bathrooms,
                'area' => $property->area,
                'property_type' => $property->property_type,
                'status' => $property->status,
                'description' => $property->description,
                'exterior_features' => $property->exterior_features ?? [],
                'interior_features' => $property->interior_features ?? [],
                'location_features' => $property->location_features ?? [],
            ];
        }

        // Also collect project-level assets
        if ($project->relationLoaded('assets') || method_exists($project, 'assets')) {
            foreach (array_keys($assetsByTag) as $tag) {
                $projectAssets = $project->assets()
                    ->where('asset_type', 'image')
                    ->whereJsonContains('tags', $tag)
                    ->orderBy('order')
                    ->orderBy('created_at', 'desc')
                    ->get()
                    ->map(fn($asset) => $asset->url)
                    ->filter()
                    ->values()
                    ->toArray();
                $assetsByTag[$tag] = array_merge($assetsByTag[$tag], $projectAssets);
            }
        }

        return new self(
            entityType: 'project_expose',
            entityId: $project->id,
            layout: $layout,
            sections: ['header', 'lead_info', 'project_overview', 'properties', 'amenities', 'location', 'contact', 'footer'],
            data: [
                // Project info
                'project' => [
                    'name' => $project->name,
                    'description' => $project->description,
                    'developer' => $project->developer?->name ?? null,
                    'location' => $project->location?->name ?? null,
                ],
                // Lead info
                'lead' => [
                    'name' => $lead['client_name'] ?? $lead['name'] ?? 'N/A',
                    'email' => $lead['client_email'] ?? $lead['email'] ?? null,
                    'phone' => $lead['mobile'] ?? $lead['phone'] ?? null,
                    'company' => $lead['company_name'] ?? null,
                ],
                // Properties
                'properties' => $propertiesData,
                'properties_count' => count($propertiesData),
                // Assets
                'assets' => $assetsByTag,
                // Generated by info
                'generated_by' => self::buildAgentData($generatedBy),
                // Company branding
                'company' => self::buildCompanyData($company),
                // Generation metadata
                'generated_at' => now()->format('M d, Y H:i'),

                // Global company expose configuration
                'expose_global_config' => $globalExposeConfig,
            ],
            options: [
                'include_qr_code' => $globalExposeConfig['qr']['enabled'],
                'watermark' => false,
                'include_footer' => true,
            ]
        );
    }

    private static function resolveGeneratingUser(?User $generatedBy = null): ?User
    {
        return $generatedBy ?? auth()->user();
    }

    private static function resolveGeneratingCompany(?User $user, ?int $companyId = null): ?Company
    {
        if ($user) {
            $company = $user->company;
            $company?->loadMissing('defaultAddress');

            if ($company) {
                return $company;
            }
        }

        if ($companyId) {
            return Company::with('defaultAddress')->find($companyId);
        }

        $sessionCompany = company();

        return $sessionCompany instanceof Company ? $sessionCompany : null;
    }

    private static function buildAgentData(?User $agent): array
    {
        $agent?->loadMissing(['employeeDetail.designation']);

        $phone = self::sanitizeDisplayValue($agent?->mobile_with_phone_code);

        if ($phone === null) {
            $phone = self::sanitizeDisplayValue($agent?->mobile);
        }

        return [
            'name' => self::sanitizeDisplayValue($agent?->name_salutation ?? $agent?->name),
            'email' => self::sanitizeDisplayValue($agent?->email),
            'phone' => $phone,
            'image' => $agent?->image_url ?? null,
            'position' => self::sanitizeDisplayValue($agent?->employeeDetail?->designation?->name),
        ];
    }

    private static function buildCompanyData(?Company $company): array
    {
        $company?->loadMissing('defaultAddress');

        return [
            'name' => $company?->company_name ?? config('app.name'),
            'company_name' => $company?->company_name ?? config('app.name'),
            'logo' => $company?->logo_url ?? public_path('img/logo.png'),
            'address' => self::resolveCompanyAddress($company),
            'phone' => self::sanitizeDisplayValue($company?->company_phone),
            'email' => self::sanitizeDisplayValue($company?->company_email),
            'website' => self::sanitizeDisplayValue($company?->website),
        ];
    }

    /**
     * Resolve a display address from the company's default CompanyAddress record.
     */
    private static function resolveCompanyAddress(?Company $company): ?string
    {
        if (!$company) {
            return null;
        }

        $companyAddress = $company->defaultAddress
            ?? CompanyAddress::where('company_id', $company->id)
                ->where('is_default', 1)
                ->first();

        if (!$companyAddress) {
            return null;
        }

        $parts = array_filter([
            self::sanitizeDisplayValue($companyAddress->address),
            self::sanitizeDisplayValue($companyAddress->location),
        ]);

        return $parts !== [] ? implode(', ', $parts) : null;
    }

    /**
     * Normalize optional display values — empty strings and UI placeholders become null.
     */
    private static function sanitizeDisplayValue(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $trimmed = trim($value);

        if ($trimmed === '' || $trimmed === '--') {
            return null;
        }

        return $trimmed;
    }

    private static function resolveGlobalExposeConfiguration(?int $companyId): array
    {
        $defaults = [
            'outro' => [
                'enabled' => false,
                'title' => null,
                'description' => null,
                'primary_image_url' => null,
                'secondary_image_url' => null,
            ],
            'qr' => [
                'enabled' => false,
                'link' => null,
                'qr_code_data_uri' => null,
            ],
        ];

        if (!$companyId) {
            return $defaults;
        }

        $config = CompanyExposeConfiguration::where('company_id', $companyId)->first();

        if (!$config) {
            return $defaults;
        }

        return [
            'outro' => [
                'enabled' => (bool) $config->outro_enabled,
                'title' => $config->outro_title,
                'description' => $config->outro_description,
                'primary_image_url' => $config->outro_primary_image_url,
                'secondary_image_url' => $config->outro_secondary_image_url,
            ],
            'qr' => [
                'enabled' => (bool) $config->qr_enabled,
                'link' => $config->qr_code_link,
                'qr_code_data_uri' => null,
            ],
        ];
    }

    public function toArray(): array
    {
        return [
            'entity_type' => $this->entityType,
            'entity_id' => $this->entityId,
            'layout' => $this->layout,
            'sections' => $this->sections,
            'data' => $this->data,
            'options' => $this->options,
        ];
    }

    public function get(string $key, $default = null): mixed
    {
        return data_get($this->data, $key, $default);
    }

    public function has(string $key): bool
    {
        return data_get($this->data, $key) !== null;
    }

    /**
     * Resolve facility labels, per-slug images, and gallery fallbacks for expose payloads.
     *
     * @param  list<string>  $facilitySlugs
     * @return array{
     *     facility_slugs: list<string>,
     *     facility_labels: list<string>,
     *     facility_images_by_slug: array<string, list<string>>,
     *     facility_default_images_by_slug: array<string, string|null>,
     *     facility_gallery_images: list<string>
     * }
     */
    private static function resolveFacilityPayload(array $facilitySlugs, ?int $companyId, ?DeveloperProject $project = null): array
    {
        $facilitySlugs = array_values(array_filter($facilitySlugs, fn ($slug) => is_string($slug) && $slug !== ''));

        $facilityMetaByName = collect();
        if ($companyId && $facilitySlugs !== []) {
            $facilityMetaByName = ProjectFacility::where('company_id', $companyId)
                ->whereIn('name', $facilitySlugs)
                ->get(['name', 'label', 'image_url'])
                ->keyBy('name');
        }

        $facilityLabels = [];
        $facilityDefaultImagesBySlug = [];
        foreach ($facilitySlugs as $facilityKey) {
            $facilityMeta = $facilityMetaByName->get($facilityKey);
            $facilityLabels[] = $facilityMeta?->label ?? ucfirst(str_replace('_', ' ', $facilityKey));
            $facilityDefaultImagesBySlug[$facilityKey] = $facilityMeta?->image_url;
        }

        $facilityImagesBySlug = [];
        foreach ($facilitySlugs as $facilityKey) {
            $facilityImagesBySlug[$facilityKey] = [];
        }

        $genericFacilityImages = [];
        if ($project) {
            $projectImageAssets = $project->relationLoaded('assets')
                ? $project->assets->where('asset_type', 'image')->sortBy([
                    ['order', 'asc'],
                    ['created_at', 'desc'],
                ])->values()
                : $project->assets()
                    ->where('asset_type', 'image')
                    ->orderBy('order')
                    ->orderBy('created_at', 'desc')
                    ->get();

            foreach ($projectImageAssets as $asset) {
                $url = $asset->url;
                if (empty($url)) {
                    continue;
                }

                $tags = $asset->tags ?? [];
                if (in_array('facilities', $tags, true)) {
                    $genericFacilityImages[] = $url;
                }

                foreach ($tags as $tag) {
                    if (!is_string($tag) || !str_starts_with($tag, 'facilities:')) {
                        continue;
                    }

                    $slug = substr($tag, strlen('facilities:'));
                    if ($slug === '' || !array_key_exists($slug, $facilityImagesBySlug)) {
                        continue;
                    }

                    $facilityImagesBySlug[$slug][] = $url;
                }
            }
        }

        $facilityGalleryImages = [];
        $remainingGenericFacilityImages = $genericFacilityImages;

        foreach ($facilitySlugs as $facilityKey) {
            if (!empty($facilityImagesBySlug[$facilityKey])) {
                $facilityGalleryImages[] = $facilityImagesBySlug[$facilityKey][0];
                continue;
            }

            $defaultImage = $facilityDefaultImagesBySlug[$facilityKey] ?? null;
            if (!empty($defaultImage)) {
                $facilityGalleryImages[] = $defaultImage;
                continue;
            }

            while (!empty($remainingGenericFacilityImages)) {
                $genericImage = array_shift($remainingGenericFacilityImages);
                if (!in_array($genericImage, $facilityGalleryImages, true)) {
                    $facilityGalleryImages[] = $genericImage;
                    break;
                }
            }
        }

        foreach ($remainingGenericFacilityImages as $url) {
            if (!in_array($url, $facilityGalleryImages, true)) {
                $facilityGalleryImages[] = $url;
            }
        }

        return [
            'facility_slugs' => $facilitySlugs,
            'facility_labels' => $facilityLabels,
            'facility_images_by_slug' => $facilityImagesBySlug,
            'facility_default_images_by_slug' => $facilityDefaultImagesBySlug,
            'facility_gallery_images' => $facilityGalleryImages,
        ];
    }

    /**
     * Group preloaded image assets by tag without issuing per-tag DB queries.
     *
     * @param  iterable<int, object>  $assets
     * @param  string[]  $tags
     * @return array<string, string[]>
     */
    private static function groupImageAssetsByTags(iterable $assets, array $tags): array
    {
        $images = collect($assets)
            ->filter(fn ($asset) => ($asset->asset_type ?? null) === 'image')
            ->sortBy([
                fn ($asset) => $asset->order ?? PHP_INT_MAX,
                fn ($asset) => -1 * ($asset->created_at?->getTimestamp() ?? 0),
            ])
            ->values();

        $grouped = array_fill_keys($tags, []);

        foreach ($images as $asset) {
            $url = $asset->url ?? null;
            if (empty($url)) {
                continue;
            }

            foreach ($asset->tags ?? [] as $tag) {
                if (array_key_exists($tag, $grouped)) {
                    $grouped[$tag][] = $url;
                }
            }
        }

        return $grouped;
    }

    /**
     * Prefer primary assets per tag, then fall back to secondary assets.
     *
     * @param  array<string, string[]>  $primary
     * @param  array<string, string[]>  $fallback
     * @param  string[]  $tags
     * @return array<string, string[]>
     */
    private static function mergeAssetTagsWithFallback(array $primary, array $fallback, array $tags): array
    {
        $merged = [];

        foreach ($tags as $tag) {
            $merged[$tag] = !empty($primary[$tag])
                ? $primary[$tag]
                : ($fallback[$tag] ?? []);
        }

        return $merged;
    }
}