<?php

namespace App\Http\Controllers;

use App\Models\DeveloperProject;
use App\Models\DeveloperProjectUnitType;
use App\Models\Property;
use App\Models\ProjectFacility;
use App\Models\ProjectLocation;
use App\Models\Lead;
use App\Helper\Reply;
use App\Services\PdfExpose\ExposeGeneratorService;
use App\Services\PdfExpose\Configuration\ExposeConfiguration;
use App\Support\FeatureFlags;
use App\Support\DeveloperProjectVisibility;
use App\Support\DeveloperProjectListingQuery;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

/**
 * DeveloperProjectController
 * 
 * Handles CRUD operations for developer projects and property assignments.
 * Projects are the main entity that groups properties together and links
 * to expose configurations for PDF generation.
 */
class DeveloperProjectController extends AccountBaseController
{
    public function __construct(
        private ExposeGeneratorService $exposeService
    ) {
        parent::__construct();
        
        // TODO: Add permission checks when permissions are defined
        // $this->middleware(function ($request, $next) {
        //     abort_403(!in_array('view_developer_projects', $this->user->permission->permissions));
        //     return $next($request);
        // });
    }

    /**
     * Normalize location text for stable uniqueness checks.
     */
    private function normalizeLocationText(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $normalized = preg_replace('/\s+/', ' ', trim($value));

        return $normalized === '' ? null : $normalized;
    }

    /**
     * Build canonical location name as "Area, City".
     */
    private function formatLocationName(?string $city, ?string $area): ?string
    {
        $parts = array_filter([$area, $city], fn ($part) => $part !== null && $part !== '');
        $name = implode(', ', $parts);

        return $name !== '' ? $name : null;
    }

    /**
     * Resolve or create a canonical project location for city+area.
     *
     * Only city/area/name are written on the shared location. Map pins
     * (address, lat/lng, map_url) live on developer_projects.
     */
    private function resolveCanonicalProjectLocation(Request $request, ?ProjectLocation $currentLocation = null): ?ProjectLocation
    {
        $incomingCity = $request->has('city') ? $request->input('city') : ($currentLocation->city ?? null);
        $incomingArea = $request->has('area') ? $request->input('area') : ($currentLocation->area ?? null);

        $city = $this->normalizeLocationText(is_string($incomingCity) ? $incomingCity : null);
        $area = $this->normalizeLocationText(is_string($incomingArea) ? $incomingArea : null);

        // No canonical key available; keep existing behavior for explicit location selection.
        if (!$city && !$area) {
            return null;
        }

        $name = $this->formatLocationName($city, $area);

        $payload = [
            'company_id' => user()->company_id,
            'city' => $city,
            'area' => $area,
            'name' => $name,
        ];

        $normalizedCity = strtolower($city ?? '');
        $normalizedArea = strtolower($area ?? '');

        return DB::transaction(function () use ($normalizedCity, $normalizedArea, $payload) {
            $location = ProjectLocation::withTrashed()
                ->where('company_id', user()->company_id)
                ->whereRaw('LOWER(TRIM(COALESCE(city, ""))) = ?', [$normalizedCity])
                ->whereRaw('LOWER(TRIM(COALESCE(area, ""))) = ?', [$normalizedArea])
                ->orderBy('id')
                ->first();

            if ($location) {
                if ($location->trashed()) {
                    $location->restore();
                }

                $location->fill($payload);
                $location->save();

                return $location;
            }

            return ProjectLocation::create($payload);
        });
    }

    /**
     * Extract per-project map pin fields from the request.
     *
     * @return array<string, mixed>
     */
    private function extractProjectPinFields(Request $request): array
    {
        $pins = [];

        if ($request->has('map_url')) {
            $pins['map_url'] = $request->input('map_url');
        }

        if ($request->has('latitude')) {
            $pins['latitude'] = $request->input('latitude');
        }

        if ($request->has('longitude')) {
            $pins['longitude'] = $request->input('longitude');
        }

        if ($request->has('address')) {
            $address = $request->input('address');
            if (is_string($address)) {
                $address = $address !== '' ? ['street' => $address] : null;
            }
            $pins['address'] = $address;
        }

        return $pins;
    }

    /**
     * Serialize a project for JSON replies with pin-overlaid nested location.
     *
     * @param  list<string>  $relations
     * @return array<string, mixed>
     */
    private function projectPayloadForReply(DeveloperProject $project, array $relations = ['location', 'developer']): array
    {
        $project->loadMissing($relations);
        $data = $project->toArray();
        $data['location'] = $project->locationForApi();

        return $data;
    }

    /**
     * Display a listing of developer projects.
     * 
     * Supports search filtering and returns paginated results with
     * related location and property count data.
     */
    public function index(Request $request)
    {
        $filtersV2Enabled = FeatureFlags::enabled('crm.projects-filters-v2');
        // v2's field set relies on the city/area location filtering path, so
        // enabling v2 alone (without also flipping the older flag) must still
        // get it rather than silently falling back to location_id filtering.
        $filtersModalEnabled = FeatureFlags::enabled('crm.projects-filters-modal') || $filtersV2Enabled;

        $query = DeveloperProject::with(['location', 'exposeConfig', 'developer', 'thumbnail', 'assets'])
            ->withCount('properties')
            ->withCount(['properties as sold_properties_count' => function ($q) {
                $q->where('status', Property::STATUS_SOLD);
            }])
            ->where('company_id', user()->company_id);

        DeveloperProjectVisibility::scopeVisibleProjects($query);

        $filterKeys = [
            'search', 'sort',
            'developer_id', 'construction_status', 'primary_category',
            'payment_plan_duration', 'price_min', 'price_max',
            // v2 additions — absent/no-op under the legacy UI.
            'title_deed_type', 'unit_types',
            'completion_start', 'completion_end',
            'min_number_of_phases', 'max_number_of_phases',
            'min_total_units', 'max_total_units',
            'min_payment_plan_duration', 'max_payment_plan_duration',
            'min_starting_price', 'max_starting_price',
            'downpayment_type', 'rental_guarantee', 'is_hidden',
            'facilities',
        ];

        if ($filtersModalEnabled) {
            $filterKeys[] = 'city';
            $filterKeys[] = 'area';
        } else {
            $filterKeys[] = 'location_id';
        }

        $listingFilters = $request->only($filterKeys);
        DeveloperProjectListingQuery::apply($query, $listingFilters, $filtersModalEnabled);

        $projects = $query->paginate(15);

        $developersQuery = \App\Models\Developer::where('company_id', user()->company_id)
            ->select('id', 'name', 'is_hidden')
            ->orderBy('name');

        DeveloperProjectVisibility::scopeVisibleDevelopers($developersQuery);

        $developers = $developersQuery->get();

        $locationColumns = $filtersModalEnabled
            ? ['id', 'name', 'city', 'area']
            : ['id', 'name'];

        $locations = \App\Models\ProjectLocation::where('company_id', user()->company_id)
            ->whereHas('developerProjects')
            ->select($locationColumns)
            ->orderBy('name')
            ->get();

        // Project-level statuses (pre_construction/active_construction/post_construction/complete) —
        // NOT PropertyConstructionStatus, which is a different value space (off_plan/under_construction/…)
        // for individual properties and never matches developer_projects.construction_status.
        $constructionStatuses = collect(DeveloperProject::CONSTRUCTION_STATUS_LABELS)
            ->map(fn ($label, $name) => ['name' => $name, 'label' => $label])
            ->values();

        $primaryCategories = \App\Models\PropertyPrimaryCategory::where('company_id', user()->company_id)
            ->select('name', 'label')
            ->orderBy('label')
            ->get();

        $props = [
            'pageTitle' => 'Construction Projects',
            'projects' => $projects,
            'developers' => $developers,
            'locations' => $locations,
            'constructionStatuses' => $constructionStatuses,
            'primaryCategories' => $primaryCategories,
            'filters' => $request->only($filterKeys),
            'visibility' => [
                'enabled' => DeveloperProjectVisibility::enabled(),
                'canSeeHidden' => DeveloperProjectVisibility::canSeeHiddenProjects(),
                'canToggleHidden' => DeveloperProjectVisibility::canToggleProjectHidden(),
            ],
        ];

        if ($filtersV2Enabled) {
            $props['titleDeedTypes'] = collect(DeveloperProject::TITLE_DEED_TYPE_LABELS)
                ->map(fn ($label, $value) => ['name' => $value, 'label' => $label])
                ->values();
            $props['unitTypeOptions'] = collect(DeveloperProject::UNIT_TYPE_LABELS)
                ->map(fn ($label, $value) => ['name' => $value, 'label' => $label])
                ->values();
            $props['projectFacilities'] = \App\Models\ProjectFacility::where('company_id', user()->company_id)
                ->select('name', 'label', 'icon')
                ->orderBy('label')
                ->get();
            $props['savedViews'] = Inertia::defer(fn () => $this->projectSavedViewsForUser());
        }

        return Inertia::render('DeveloperProjects/Index', $props);
    }

    /**
     * Saved filter views the current user may open: their own plus team-shared.
     *
     * @return array<int, array<string, mixed>>
     */
    private function projectSavedViewsForUser(): array
    {
        $userId = (int) user()->id;

        return \App\Models\ProjectSavedView::query()
            ->visibleTo($userId)
            ->with('owner:id,name')
            ->orderByDesc('updated_at')
            ->get()
            ->map(fn (\App\Models\ProjectSavedView $view) => [
                'id' => $view->id,
                'name' => $view->name,
                'filters' => $view->filters,
                'visibility' => $view->visibility,
                'pinned' => $view->pinned,
                'is_owner' => (int) $view->user_id === $userId,
                'owner_name' => $view->owner?->name,
                'updated_at' => $view->updated_at?->toIso8601String(),
            ])
            ->all();
    }

    /**
     * Get a single developer project with all related data.
     */
    public function show(Request $request, $id)
    {
        $project = DeveloperProject::with(['location', 'exposeConfig', 'properties.assets', 'developer', 'assets', 'thumbnail', 'unitTypes.assets', 'unitTypes.offers', 'offers'])
            ->withCount('properties')
            ->where('company_id', user()->company_id)
            ->findOrFail($id);

        DeveloperProjectVisibility::assertProjectVisible($project);

        // Calculate statistics
        $computedTotalUnits = $project->unitTypes->sum('quantity');
        $unitCount = $project->unitTypes->count();
        $computedTotalSold = $project->unitTypes->sum('total_sold');
        // Use explicit project-level overrides when set, otherwise fall back to computed values
        $totalUnits = $project->total_units ?? $computedTotalUnits;
        $totalSold = $project->total_units_sold ?? $computedTotalSold;
        $soldProperties = $project->properties->where('status', Property::STATUS_SOLD)->count();
        $underOfferProperties = $project->properties->where('status', Property::STATUS_UNDER_OFFER)->count();

        // Find lowest starting price across unit types
        $lowestPriceUnit = $project->unitTypes->whereNotNull('starting_price')->sortBy('starting_price')->first();
        if ($project->starting_price !== null) {
            // Project-level override has no currency of its own; a project has one currency, so use the unit types'.
            $startingPrice = (float) $project->starting_price;
            $startingPriceCurrency = $project->unitTypes->first()?->currency ?? 'GBP';
        } else {
            $startingPrice = $lowestPriceUnit ? (float) $lowestPriceUnit->starting_price : null;
            $startingPriceCurrency = $lowestPriceUnit?->currency ?? 'GBP';
        }
        $startingPriceFormatted = $startingPrice !== null
            ? (DeveloperProjectUnitType::CURRENCIES[$startingPriceCurrency]['symbol'] ?? '£') . number_format($startingPrice, 0)
            : null;

        // Build unit types summary (grouped by property_type)
        $unitTypesSummary = $this->getUnitTypesSummary($project->unitTypes);

        // Get aggregated facilities from properties
        $facilities = $this->getAggregatedFacilities($project);

        // Get images by tag (exterior, interior, floor_plan/site_plan)
        $imagesByTag = $this->getImagesByTag($project);

        // Get project-level facility images keyed by facility slug via "facilities:<slug>" tags
        $facilityImagesBySlug = $this->getFacilityImagesBySlug($project, $facilities);

        // Get price list by property type
        $priceList = $this->getPriceListByType($project->properties);

        // Load other projects by the same developer (excluding current)
        $developerProjects = collect();
        if ($project->developer_id) {
            $relatedQuery = DeveloperProject::with([
                    'thumbnail',
                     'assets',
                    'location',
                    'developer',
                ])
                ->withCount('properties')
                ->withCount(['properties as sold_properties_count' => function ($q) {
                    $q->where('status', Property::STATUS_SOLD);
                }])
                ->where('company_id', user()->company_id)
                ->where('developer_id', $project->developer_id)
                ->where('id', '!=', $project->id);

            DeveloperProjectVisibility::scopeVisibleProjects($relatedQuery);

            $developerProjects = $relatedQuery
                ->orderBy('created_at', 'desc')
                ->get();
        }

        $projectPayload = $project->toArray();
        $projectPayload['location'] = $project->locationForApi();

        return Inertia::render('DeveloperProjects/Show', [
            'pageTitle' => $project->name,
            'project' => $projectPayload,
            'statistics' => [
                'total_units' => $totalUnits,
                'unit_count' => $unitCount,
                'sold_properties' => $totalSold,
                'total_sold' => $totalSold,
                'sold_properties' => $soldProperties,
                'under_offer_properties' => $underOfferProperties,
                'starting_price' => $startingPrice,
                'starting_price_formatted' => $startingPriceFormatted,
                'starting_price_currency' => $startingPriceCurrency,
            ],
            'unitTypesSummary' => $unitTypesSummary,
            'facilities' => $facilities,
            'imagesByTag' => $imagesByTag,
            'facilityImagesBySlug' => $facilityImagesBySlug,
            'priceList' => $priceList,
            'unitTypePriceList' => $this->getUnitTypePriceList($project->unitTypes),
            'unitTypes' => $project->unitTypes->sortBy('order')->values(),
            'developerProjects' => $developerProjects,
            'visibility' => [
                'enabled' => DeveloperProjectVisibility::enabled(),
                'canSeeHidden' => DeveloperProjectVisibility::canSeeHiddenProjects(),
                'canToggleHidden' => DeveloperProjectVisibility::canToggleProjectHidden(),
            ],
        ]);
    }

    /**
     * Get unit types summary grouped by property_type with aggregated stats.
     */
    private function getUnitTypesSummary($unitTypes)
    {
        $grouped = $unitTypes->groupBy('property_type');
        $summary = [];

        foreach ($grouped as $type => $types) {
            if (empty($type)) continue;

            $bedrooms = $types->pluck('bedrooms')->filter();
            $bathrooms = $types->pluck('bathrooms')->filter();
            $areas = $types->pluck('total_area_sqm')->filter()->map(fn($a) => (float) $a);
            $prices = $types->pluck('starting_price')->filter()->map(fn($p) => (float) $p);

            $summary[] = [
                'type' => $type,
                'quantity' => $types->sum('quantity'),
                'bedrooms' => [
                    'min' => $bedrooms->min(),
                    'max' => $bedrooms->max(),
                ],
                'bathrooms' => [
                    'min' => $bathrooms->min(),
                    'max' => $bathrooms->max(),
                ],
                'area' => [
                    'min' => $areas->min(),
                    'max' => $areas->max(),
                ],
                'price' => [
                    'min' => $prices->min(),
                    'max' => $prices->max(),
                ],
            ];
        }

        return $summary;
    }

    /**
     * Get aggregated facilities from project and its properties.
     */
    private function getAggregatedFacilities(DeveloperProject $project)
    {
        $slugs = collect($project->facilities ?? []);

        // Merge unique facilities from properties' exterior and interior features
        foreach ($project->properties as $property) {
            if (!empty($property->exterior_features)) {
                $slugs = $slugs->merge($property->exterior_features);
            }
            if (!empty($property->interior_features)) {
                $slugs = $slugs->merge($property->interior_features);
            }
        }

        $uniqueSlugs = $slugs->unique()->values();

        // Resolve slugs to enriched objects from project_facilities table
        $facilityMap = ProjectFacility::where('company_id', user()->company_id)
            ->whereIn('name', $uniqueSlugs)
            ->get()
            ->keyBy('name');

        return $uniqueSlugs->map(function ($slug) use ($facilityMap) {
            if ($facilityMap->has($slug)) {
                $f = $facilityMap->get($slug);
                return ['name' => $f->name, 'label' => $f->label, 'icon' => $f->icon];
            }
            // Fallback for slugs not in the DB
            return ['name' => $slug, 'label' => ucfirst(str_replace('_', ' ', $slug)), 'icon' => null];
        })->values()->all();
    }

    /**
     * Get images organized by tag from project and its properties.
     */
    private function getImagesByTag(DeveloperProject $project)
    {
        $tags = ['exterior', 'interior', 'floor-plan', 'site-plan', 'facilities', 'gallery'];
        $imagesByTag = [];

        foreach ($tags as $tag) {
            $images = collect();

            // Get images from project assets
            $projectImages = $project->assets()
                ->images()
                ->byTag($tag)
                ->ordered()
                ->get()
                ->map(fn($asset) => [
                    'id' => $asset->id,
                    'url' => $asset->url,
                    'name' => $asset->name,
                    'source' => 'project',
                ]);
            $images = $images->merge($projectImages);

            // Get images from unit type assets
            foreach ($project->unitTypes as $unitType) {
                $unitTypeImages = $unitType->assets
                    ->filter(fn($a) => $a->asset_type === 'image' && in_array($tag, $a->tags ?? []))
                    ->map(fn($asset) => [
                        'id'             => $asset->id,
                        'url'            => $asset->url,
                        'name'           => $asset->name,
                        'source'         => 'unit_type',
                        'unit_type_id'   => $unitType->id,
                        'unit_type_name' => $unitType->display_label ?? $unitType->reference_code,
                    ]);
                $images = $images->merge($unitTypeImages);
            }

            // Get images from property assets
            foreach ($project->properties as $property) {
                $propertyImages = $property->assets()
                    ->images()
                    ->byTag($tag)
                    ->ordered()
                    ->get()
                    ->map(fn($asset) => [
                        'id' => $asset->id,
                        'url' => $asset->url,
                        'name' => $asset->name,
                        'source' => 'property',
                        'property_id' => $property->id,
                        'property_title' => $property->title,
                    ]);
                $images = $images->merge($propertyImages);
            }

            $imagesByTag[$tag] = $images->values()->all();
        }

        return $imagesByTag;
    }

    /**
     * Get project-level facility images organized by facility slug.
     *
     * Uses tags with format: facilities:<facility-slug>
     */
    private function getFacilityImagesBySlug(DeveloperProject $project, array $facilities): array
    {
        $map = [];
        $facilityNames = collect($facilities)
            ->pluck('name')
            ->filter()
            ->values();

        foreach ($facilityNames as $facilitySlug) {
            $map[$facilitySlug] = [];
        }

        $projectAssets = $project->assets()
            ->images()
            ->ordered()
            ->get();

        foreach ($projectAssets as $asset) {
            $tags = collect($asset->tags ?? []);

            $facilityTags = $tags
                ->filter(fn($tag) => is_string($tag) && Str::startsWith($tag, 'facilities:'))
                ->values();

            foreach ($facilityTags as $facilityTag) {
                $slug = Str::after($facilityTag, 'facilities:');
                if ($slug === '' || !array_key_exists($slug, $map)) {
                    continue;
                }

                $map[$slug][] = [
                    'id' => $asset->id,
                    'url' => $asset->url,
                    'name' => $asset->name,
                    'source' => 'project',
                ];
            }
        }

        return $map;
    }

    /**
     * Get price list organized by property type (legacy — used by ExposeGenerationModal).
     */
    private function getPriceListByType($properties)
    {
        $grouped = $properties->groupBy('property_type');
        $priceList = [];

        foreach ($grouped as $type => $props) {
            if (empty($type)) continue;

            $prices = $props->pluck('price')->filter();
            
            $priceList[] = [
                'type' => $type,
                'count' => $props->count(),
                'min_price' => $prices->min(),
                'max_price' => $prices->max(),
                'properties' => $props->map(fn($p) => [
                    'id' => $p->id,
                    'title' => $p->title,
                    'price' => $p->price,
                    'status' => $p->status,
                    'bedrooms' => $p->bedrooms,
                    'bathrooms' => $p->bathrooms,
                ])->values()->all(),
            ];
        }

        return $priceList;
    }

    /**
     * Get price list organized by property type from unit types.
     */
    private function getUnitTypePriceList($unitTypes)
    {
        $grouped = $unitTypes->groupBy('property_type');
        $priceList = [];

        foreach ($grouped as $type => $units) {
            if (empty($type)) continue;

            $prices = $units->pluck('starting_price')->filter();

            $priceList[] = [
                'type' => $type,
                'count' => $units->count(),
                'min_price' => $prices->min() ? (float) $prices->min() : null,
                'max_price' => $prices->max() ? (float) $prices->max() : null,
                'currency' => $units->first()->currency ?? 'GBP',
                'currency_symbol' => $units->first()->currency_symbol ?? '£',
                'unit_types' => $units->map(fn($ut) => [
                    'id' => $ut->id,
                    'reference_code' => $ut->reference_code,
                    'starting_price' => $ut->starting_price ? (float) $ut->starting_price : null,
                    'formatted_price' => $ut->formatted_price,
                    'currency' => $ut->currency,
                    'currency_symbol' => $ut->currency_symbol,
                    'bedrooms' => $ut->bedrooms,
                    'bathrooms' => $ut->bathrooms,
                    'floor' => $ut->floor,
                    'total_area_sqm' => $ut->total_area_sqm ? (float) $ut->total_area_sqm : null,
                    'quantity' => $ut->quantity,
                    'is_sold_out' => (bool) $ut->is_sold_out,
                ])->values()->all(),
            ];
        }

        return $priceList;
    }

    /**
     * Store a new developer project.
     * 
     * Creates the project with basic info and optional location assignment.
     * Expose config is created separately when needed.
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'reference_code' => 'nullable|string|max:50',
            'description' => 'nullable|string',
            'developer_id' => 'nullable|exists:developers,id',
            'project_location_id' => 'nullable|exists:project_locations,id',
            // Construction project fields
            'google_drive_link' => 'nullable|url|max:2048',
            'availability_link' => 'nullable|url|max:2048',
            'starting_price' => 'nullable|numeric|min:0',
            'primary_categories' => 'nullable|array',
            'primary_categories.*' => 'string|in:residential,commercial',
            'title_deed_type' => 'nullable|string|in:' . implode(',', DeveloperProject::TITLE_DEED_TYPES),
            'unit_types' => 'nullable|array',
            'unit_types.*' => 'string|in:' . implode(',', DeveloperProject::UNIT_TYPES),
            'number_of_units' => 'nullable|integer|min:0',
            'total_units' => 'nullable|integer|min:0',
            'total_units_sold' => 'nullable|integer|min:0',
            'number_of_blocks' => 'nullable|integer|min:0',
            'project_total_area_sqm' => 'nullable|numeric|min:0',
            'construction_status' => 'nullable|string|in:' . implode(',', DeveloperProject::CONSTRUCTION_STATUSES),
            'completion_date' => 'nullable|date',
            'number_of_phases' => 'nullable|integer|min:0',
            'furniture_package' => 'nullable|string|in:' . implode(',', DeveloperProject::FURNITURE_PACKAGES),
            'rental_guarantee' => 'nullable|boolean',
            'payment_plan' => 'nullable|array',
            'payment_plan.enabled' => 'nullable|boolean',
            'payment_plan.downpayment_type' => 'nullable|string|in:percentage,amount',
            'payment_plan.downpayment_value' => 'nullable|numeric|min:0',
            'payment_plan.period_months' => 'nullable|integer|min:0',
            'payment_plan.interest_rate' => 'nullable|numeric|min:0',
            'facilities' => 'nullable|array',
            'facilities.*' => 'string',
            'distances' => 'nullable|array',
            'distances.*' => 'nullable|numeric|min:0',
            'is_hidden' => 'nullable|boolean',
            // Location fields passed flat (for creating/updating project location)
            'city' => 'nullable|string|max:255',
            'area' => 'nullable|string|max:255',
            'address' => 'nullable|string|max:500',
            'latitude' => 'nullable|numeric',
            'longitude' => 'nullable|numeric',
            'map_url' => 'nullable|url|max:2048',
        ]);

        if ($validator->fails()) {
            return Reply::error($validator->errors()->first());
        }

        // Unique combination: developer_id + name (within the same company)
        if ($request->filled('developer_id') && $request->filled('name')) {
            $duplicate = DeveloperProject::where('company_id', user()->company_id)
                ->where('developer_id', $request->developer_id)
                ->where('name', $request->name)
                ->exists();

            if ($duplicate) {
                return Reply::error('A project with this name already exists for the selected developer.');
            }
        }

        // Handle location with canonical city+area uniqueness (shared area row only).
        $locationId = $request->project_location_id;
        if ($request->filled('city') || $request->filled('area')) {
            $location = $this->resolveCanonicalProjectLocation($request);
            $locationId = $location?->id;
        }

        // If the project name is not in the developer's project_list, add it
        if ($request->filled('developer_id') && $request->filled('name')) {
            $developer = \App\Models\Developer::find($request->developer_id);
            if ($developer) {
                $projectList = $developer->project_list ?? [];
                if (!in_array($request->name, $projectList)) {
                    $projectList[] = $request->name;
                    $developer->update(['project_list' => $projectList]);
                }
            }
        }

        $createPayload = [
            'company_id' => user()->company_id,
            'developer_id' => $request->developer_id,
            'name' => $request->name,
            'reference_code' => $request->reference_code,
            'description' => $request->description,
            'project_location_id' => $locationId,
            // Construction project fields
            'google_drive_link' => $request->google_drive_link,
            'availability_link' => $request->availability_link,
            'starting_price' => $request->starting_price,
            'primary_categories' => $request->primary_categories,
            'title_deed_type' => $request->title_deed_type,
            'unit_types' => $request->unit_types,
            'number_of_units' => $request->number_of_units,
            'total_units' => $request->total_units,
            'total_units_sold' => $request->total_units_sold,
            'number_of_blocks' => $request->number_of_blocks,
            'project_total_area_sqm' => $request->project_total_area_sqm,
            'construction_status' => $request->construction_status,
            'completion_date' => $request->completion_date,
            'number_of_phases' => $request->number_of_phases,
            'furniture_package' => $request->furniture_package,
            'rental_guarantee' => $request->rental_guarantee ?? false,
            'payment_plan' => $request->payment_plan,
            'facilities' => $request->facilities,
            'distances' => $request->distances,
            'remind_at' => $request->remind_at,
            'reminders' => $request->reminders,
        ];

        $createPayload = array_merge($createPayload, $this->extractProjectPinFields($request));

        if (
            DeveloperProjectVisibility::enabled()
            && DeveloperProjectVisibility::canToggleProjectHidden()
            && $request->has('is_hidden')
        ) {
            $createPayload['is_hidden'] = (bool) $request->boolean('is_hidden');
        }

        $project = DeveloperProject::create($createPayload);

        app(\App\Services\Reminders\DeveloperProjectReminderSync::class)->syncFromProject($project->fresh());

        return Reply::successWithData('Construction project created successfully', [
            'data' => $this->projectPayloadForReply($project->fresh()),
        ]);
    }

    /**
     * Update a developer project.
     */
    public function update(Request $request, $id)
    {
        $project = DeveloperProject::where('company_id', user()->company_id)
            ->findOrFail($id);

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|required|string|max:255',
            'reference_code' => 'nullable|string|max:50',
            'description' => 'nullable|string',
            'developer_id' => 'nullable|exists:developers,id',
            'project_location_id' => 'nullable|exists:project_locations,id',
            // Construction project fields
            'google_drive_link' => 'nullable|url|max:2048',
            'availability_link' => 'nullable|url|max:2048',
            'starting_price' => 'nullable|numeric|min:0',
            'primary_categories' => 'nullable|array',
            'primary_categories.*' => 'string|in:residential,commercial',
            'title_deed_type' => 'nullable|string|in:' . implode(',', DeveloperProject::TITLE_DEED_TYPES),
            'unit_types' => 'nullable|array',
            'unit_types.*' => 'string|in:' . implode(',', DeveloperProject::UNIT_TYPES),
            'number_of_units' => 'nullable|integer|min:0',
            'total_units' => 'nullable|integer|min:0',
            'total_units_sold' => 'nullable|integer|min:0',
            'number_of_blocks' => 'nullable|integer|min:0',
            'project_total_area_sqm' => 'nullable|numeric|min:0',
            'construction_status' => 'nullable|string|in:' . implode(',', DeveloperProject::CONSTRUCTION_STATUSES),
            'completion_date' => 'nullable|date',
            'number_of_phases' => 'nullable|integer|min:0',
            'furniture_package' => 'nullable|string|in:' . implode(',', DeveloperProject::FURNITURE_PACKAGES),
            'rental_guarantee' => 'nullable|boolean',
            'payment_plan' => 'nullable|array',
            'payment_plan.enabled' => 'nullable|boolean',
            'payment_plan.downpayment_type' => 'nullable|string|in:percentage,amount',
            'payment_plan.downpayment_value' => 'nullable|numeric|min:0',
            'payment_plan.period_months' => 'nullable|integer|min:0',
            'payment_plan.interest_rate' => 'nullable|numeric|min:0',
            'facilities' => 'nullable|array',
            'facilities.*' => 'string',
            'distances' => 'nullable|array',
            'distances.*' => 'nullable|numeric|min:0',
            'is_hidden' => 'nullable|boolean',
            // Location fields
            'city' => 'nullable|string|max:255',
            'area' => 'nullable|string|max:255',
            'address' => 'nullable|string|max:500',
            'latitude' => 'nullable|numeric',
            'longitude' => 'nullable|numeric',
            'map_url' => 'nullable|url|max:2048',
        ]);

        if ($validator->fails()) {
            return Reply::error($validator->errors()->first());
        }

        // Unique combination: developer_id + name (within the same company, excluding self)
        $developerId = $request->has('developer_id') ? $request->developer_id : $project->developer_id;
        $name = $request->has('name') ? $request->name : $project->name;

        if ($developerId && $name) {
            $duplicate = DeveloperProject::where('company_id', user()->company_id)
                ->where('developer_id', $developerId)
                ->where('name', $name)
                ->where('id', '!=', $project->id)
                ->exists();

            if ($duplicate) {
                return Reply::error('A project with this name already exists for the selected developer.');
            }
        }

        // Handle shared location by city+area only (pins are stored on the project).
        if ($request->hasAny(['city', 'area'])) {
            $currentLocation = $project->location;
            $location = $this->resolveCanonicalProjectLocation($request, $currentLocation);

            if ($location) {
                $request->merge(['project_location_id' => $location->id]);
            }
        }

        $updateFields = [
            'name', 'reference_code', 'description', 'developer_id', 'project_location_id',
            'google_drive_link', 'availability_link', 'starting_price',
            'primary_categories', 'title_deed_type', 'unit_types',
            'number_of_units', 'total_units', 'total_units_sold', 'number_of_blocks', 'project_total_area_sqm',
            'construction_status', 'completion_date', 'number_of_phases',
            'furniture_package', 'rental_guarantee', 'payment_plan',
            'facilities', 'distances', 'remind_at', 'reminders',
        ];

        if (
            DeveloperProjectVisibility::enabled()
            && DeveloperProjectVisibility::canToggleProjectHidden()
            && $request->has('is_hidden')
        ) {
            $updateFields[] = 'is_hidden';
        }

        $updatePayload = array_merge(
            $request->only($updateFields),
            $this->extractProjectPinFields($request)
        );

        // Protect existing facilities from being cleared when the field is
        // omitted by a collapsed form section on the frontend.
        if (!$request->has('facilities')) {
            unset($updatePayload['facilities']);
        }

        if (array_key_exists('is_hidden', $updatePayload)) {
            $updatePayload['is_hidden'] = (bool) $request->boolean('is_hidden');
        }

        $project->update($updatePayload);

        app(\App\Services\Reminders\DeveloperProjectReminderSync::class)->syncFromProject($project->fresh());

        return Reply::successWithData('Construction project updated successfully', [
            'data' => $this->projectPayloadForReply(
                $project->fresh(),
                ['location', 'exposeConfig', 'developer']
            ),
        ]);
    }

    /**
     * Delete a developer project.
     * 
     * Soft deletes the project. Properties assigned to this project
     * will have their developer_project_id set to null (handled by FK constraint).
     */
    public function destroy($id)
    {
        $project = DeveloperProject::where('company_id', user()->company_id)
            ->findOrFail($id);

        // Unassign all properties from this project before deletion
        $project->removeAllProperties();

        app(\App\Services\Reminders\DeveloperProjectReminderSync::class)->cancelForProject($project);

        $project->delete();

        return Reply::success('Construction project deleted successfully');
    }

    /**
     * Assign properties to a project.
     * 
     * Properties can only belong to one project at a time, so this will
     * reassign them from any previous project.
     * 
     * @param Request $request Contains property_ids array
     * @param int $id Project ID
     */
    public function assignProperties(Request $request, $id)
    {
        $project = DeveloperProject::where('company_id', user()->company_id)
            ->findOrFail($id);

        $validator = Validator::make($request->all(), [
            'property_ids' => 'required|array',
            'property_ids.*' => 'exists:properties,id',
        ]);

        if ($validator->fails()) {
            return Reply::error($validator->errors()->first());
        }

        // Update properties to belong to this project
        $count = $project->assignProperties($request->property_ids);

        return Reply::successWithData("$count properties assigned successfully", [
            'project' => $project->fresh(['properties']),
            'assigned_count' => $count,
        ]);
    }

    /**
     * Remove properties from a project.
     * 
     * Sets developer_project_id to null for the specified properties,
     * but only if they currently belong to this project.
     * 
     * @param Request $request Contains property_ids array
     * @param int $id Project ID
     */
    public function removeProperties(Request $request, $id)
    {
        $project = DeveloperProject::where('company_id', user()->company_id)
            ->findOrFail($id);

        $validator = Validator::make($request->all(), [
            'property_ids' => 'required|array',
            'property_ids.*' => 'exists:properties,id',
        ]);

        if ($validator->fails()) {
            return Reply::error($validator->errors()->first());
        }

        $count = $project->removeProperties($request->property_ids);

        return Reply::success("$count properties removed from project successfully");
    }

    /**
     * Get properties available for assignment.
     * 
     * Returns properties that are either unassigned or assigned to this project.
     * Used for the property selection UI.
     */
    public function availableProperties(Request $request, $id)
    {
        $project = DeveloperProject::where('company_id', user()->company_id)
            ->findOrFail($id);

        $query = Property::where('company_id', user()->company_id)
            ->where(function ($q) use ($project) {
                $q->whereNull('developer_project_id')
                  ->orWhere('developer_project_id', $project->id);
            });

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                  ->orWhere('city', 'like', "%{$search}%")
                  ->orWhere('area', 'like', "%{$search}%");
            });
        }

        $properties = $query->select([
            'id', 'title', 'city', 'area', 'property_type', 
            'sale_type', 'price', 'status', 'developer_project_id'
        ])->paginate(20);

        return Reply::successWithData('Available properties fetched', [
            'properties' => $properties,
        ]);
    }

    /**
     * Get all projects for dropdown/select inputs.
     * Returns minimal data (id, name) for all company projects.
     */
    public function all()
    {
        $query = DeveloperProject::where('company_id', user()->company_id)
            ->select('id', 'name', 'developer_id', 'project_location_id', 'is_hidden')
            ->with(['location:id,name', 'developer:id,name,is_hidden'])
            ->orderBy('name');

        DeveloperProjectVisibility::scopeVisibleProjects($query);

        $projects = $query->get();

        return Reply::successWithData('Construction projects fetched', [
            'projects' => $projects,
        ]);
    }

    /**
     * Generate expose PDF for a developer project.
     * 
     * @deprecated Use generateProjectExpose() or generateUnitTypeExpose() instead.
     *             This method is kept for backward compatibility but will be removed.
     *
     * @param Request $request
     * @param int $id Project ID
     * @return \Illuminate\Http\Response
     */
    public function generateExpose(Request $request, $id)
    {
        $project = DeveloperProject::with(['developer', 'location', 'assets'])
            ->where('company_id', user()->company_id)
            ->findOrFail($id);

        $validator = Validator::make($request->all(), [
            'property_ids' => 'required|array|min:1',
            'property_ids.*' => 'exists:properties,id',
            'lead_id' => 'nullable|exists:leads,id',
            'lead_data' => 'nullable|array',
            'lead_data.name' => 'required_with:lead_data|string|max:255',
            'lead_data.email' => 'nullable|email',
            'lead_data.phone' => 'nullable|string',
            'lead_data.company_name' => 'nullable|string',
            'lead_type' => 'nullable|in:client,agent',
            'layout' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return Reply::error($validator->errors()->first());
        }

        // Get selected properties
        $properties = Property::with('assets')
            ->where('company_id', user()->company_id)
            ->whereIn('id', $request->property_ids)
            ->get();

        if ($properties->isEmpty()) {
            return Reply::error('No valid properties selected');
        }

        // Get or create lead
        $lead = null;
        if ($request->filled('lead_id')) {
            // Use existing lead
            $lead = Lead::where('company_id', user()->company_id)
                ->findOrFail($request->lead_id);
            $leadData = $lead->toArray();
        } elseif ($request->filled('lead_data')) {
            // Create new lead
            $leadInput = $request->lead_data;
            $lead = Lead::create([
                'company_id' => user()->company_id,
                'client_name' => $leadInput['name'],
                'client_email' => $leadInput['email'] ?? null,
                'mobile' => $leadInput['phone'] ?? null,
                'company_name' => $leadInput['company_name'] ?? null,
                'added_by' => user()->id,
                'source_id' => null, // Could add expose generation as a source
            ]);
            $leadData = $lead->toArray();
        } else {
            // No lead provided - use empty lead data
            $leadData = [
                'client_name' => 'Valued Client',
                'client_email' => null,
                'mobile' => null,
                'company_name' => null,
            ];
        }

        // Get the authenticated user who is generating the expose
        $generatedBy = user();

        // Create expose configuration
        $layout = $request->input('layout', 'vertical_standard');
        $config = ExposeConfiguration::fromProjectWithProperties(
            $project,
            $properties,
            $leadData,
            $generatedBy,
            $layout
        );

        // Generate and return the PDF
        return $this->exposeService->generate($config);
    }

    /**
     * Generate a project-level expose PDF (brochure).
     *
     * Generates a PDF showcasing the entire project: overview, facilities,
     * unit type summaries, distances, and contact info.
     */
    public function generateProjectExpose(Request $request, $id)
    {
        $project = DeveloperProject::where('company_id', user()->company_id)->findOrFail($id);

        $payload = [
            'client_name'  => $request->input('client_name'),
            'client_email' => $request->input('client_email'),
        ];

        $exposeJob = \App\Models\ExposeJob::create([
            'company_id'  => user()->company_id,
            'user_id'     => user()->id,
            'entity_type' => \App\Models\ExposeJob::ENTITY_DEVELOPER_PROJECT,
            'entity_id'   => $project->id,
            'status'      => \App\Models\ExposeJob::STATUS_QUEUED,
            'filename'    => \Illuminate\Support\Str::slug($project->name) . '-brochure.pdf',
            'payload'     => $payload,
        ]);

        \App\Jobs\GenerateExposeJob::dispatch($exposeJob->id)->onQueue(\App\Jobs\GenerateExposeJob::QUEUE);

        return Reply::successWithData('Brochure generation queued', [
            'data' => ['job_id' => $exposeJob->id],
        ]);
    }

    /**
     * Validate project expose and return warnings.
     */
    public function validateProjectExpose(Request $request, $id)
    {
        $project = DeveloperProject::with(['developer', 'location', 'assets', 'unitTypes.assets'])
            ->where('company_id', user()->company_id)
            ->findOrFail($id);

        $config = ExposeConfiguration::fromDeveloperProject($project, 'project-expose-template');

        $warnings = $this->exposeService->checkWarnings($config, [
            'context' => 'developer_project',
            'project_id' => $project->id,
            'location_id' => $project->location?->id,
        ]);

        return Reply::successWithData('Validation complete', [
            'data' => ['warnings' => $warnings],
        ]);
    }

    /**
     * Generate a unit type expose PDF.
     *
     * Creates an expose for a specific unit type within a project,
     * masquerading it as a property expose using the property template.
     * Missing data (city, distances, hero images) falls back from project/location.
     */
    public function generateUnitTypeExpose(Request $request, $projectId, $unitTypeId)
    {
        $project = DeveloperProject::where('company_id', user()->company_id)->findOrFail($projectId);

        $unitType = DeveloperProjectUnitType::where('developer_project_id', $projectId)
            ->findOrFail($unitTypeId);

        $payload = [
            'client_name'  => $request->input('client_name'),
            'client_email' => $request->input('client_email'),
        ];

        $label = $unitType->display_label ?? $unitType->property_type ?? 'unit';

        $exposeJob = \App\Models\ExposeJob::create([
            'company_id'    => user()->company_id,
            'user_id'       => user()->id,
            'entity_type'   => \App\Models\ExposeJob::ENTITY_UNIT_TYPE,
            'entity_id'     => $project->id,
            'sub_entity_id' => $unitType->id,
            'status'        => \App\Models\ExposeJob::STATUS_QUEUED,
            'filename'      => \Illuminate\Support\Str::slug($project->name . '-' . $label) . '-expose.pdf',
            'payload'       => $payload,
        ]);

        \App\Jobs\GenerateExposeJob::dispatch($exposeJob->id)->onQueue(\App\Jobs\GenerateExposeJob::QUEUE);

        return Reply::successWithData('Expose generation queued', [
            'data' => ['job_id' => $exposeJob->id],
        ]);
    }

    /**
     * Validate unit type expose and return warnings.
     */
    public function validateUnitTypeExpose(Request $request, $projectId, $unitTypeId)
    {
        // Verify project belongs to company
        DeveloperProject::where('company_id', user()->company_id)
            ->findOrFail($projectId);

        $unitType = DeveloperProjectUnitType::with(['project.developer', 'project.location', 'project.assets', 'assets'])
            ->where('developer_project_id', $projectId)
            ->findOrFail($unitTypeId);

        $config = ExposeConfiguration::fromUnitType($unitType, 'expose-template');

        $warnings = $this->exposeService->checkWarnings($config, [
            'context' => 'unit_type',
            'project_id' => (int) $projectId,
            'unit_type_id' => $unitType->id,
            'location_id' => $unitType->project?->location?->id,
        ]);

        return Reply::successWithData('Validation complete', [
            'data' => ['warnings' => $warnings],
        ]);
    }
}
