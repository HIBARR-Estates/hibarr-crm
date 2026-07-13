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

        $address = $request->has('address') ? $request->input('address') : ($currentLocation->address ?? null);
        if (is_string($address)) {
            $address = ['street' => $address];
        }

        $payload = [
            'company_id' => user()->company_id,
            'city' => $city,
            'area' => $area,
            'name' => $name,
        ];

        if ($address !== null) {
            $payload['address'] = $address;
        }

        foreach (['latitude', 'longitude', 'map_url'] as $field) {
            if ($request->has($field)) {
                $payload[$field] = $request->input($field);
            } elseif ($currentLocation && array_key_exists($field, $currentLocation->getAttributes())) {
                $payload[$field] = $currentLocation->{$field};
            }
        }

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
     * Display a listing of developer projects.
     * 
     * Supports search filtering and returns paginated results with
     * related location and property count data.
     */
    public function index(Request $request)
    {
        $query = DeveloperProject::with(['location', 'exposeConfig', 'developer', 'thumbnail', 'assets'])
            ->withCount('properties')
            ->withCount(['properties as sold_properties_count' => function ($q) {
                $q->where('status', Property::STATUS_SOLD);
            }])
            ->where('company_id', user()->company_id);

        // Search by name or description
        if ($request->filled('search')) {
            $search = trim($request->search);

            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                ->orWhere('description', 'like', "%{$search}%");
            });

            // raw ordering to rank name matches higher than description-only matches
            $query->orderByRaw("
                CASE 
                    WHEN name LIKE ? THEN 2
                    WHEN description LIKE ? THEN 1
                    ELSE 0
                END DESC
            ", ["%{$search}%", "%{$search}%"]);
        }
        // Filter by location if provided
        if ($request->filled('location_id')) {
            $query->where('project_location_id', $request->location_id);
        }

        // Filter by developer
        if ($request->filled('developer_id')) {
            $query->where('developer_id', $request->developer_id);
        }

        // Filter by construction status
        if ($request->filled('construction_status')) {
            $query->where('construction_status', $request->construction_status);
        }

        // Filter by primary category (JSON array contains)
        if ($request->filled('primary_category')) {
            $query->whereJsonContains('primary_categories', $request->primary_category);
        }

        // Filter by payment plan duration (months)
        if ($request->filled('payment_plan_duration')) {
            $durationMonths = filter_var($request->payment_plan_duration, FILTER_VALIDATE_INT, [
                'options' => ['min_range' => 0],
            ]);

            if ($durationMonths !== false) {
                $query->whereRaw(
                    "CAST(JSON_UNQUOTE(JSON_EXTRACT(payment_plan, '$.period_months')) AS UNSIGNED) = ?",
                    [$durationMonths]
                );
            }
        }

        // Filter by starting price range
        if ($request->filled('price_min')) {
            $query->where('starting_price', '>=', (float) $request->price_min);
        }
        if ($request->filled('price_max')) {
            $query->where('starting_price', '<=', (float) $request->price_max);
        }

        // Apply sort
        switch ($request->input('sort', 'newest')) {
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

        $projects = $query->paginate(12);

        $developers = \App\Models\Developer::where('company_id', user()->company_id)
            ->select('id', 'name')
            ->orderBy('name')
            ->get();

        $locations = \App\Models\ProjectLocation::where('company_id', user()->company_id)
            ->whereHas('developerProjects')
            ->select('id', 'name')
            ->orderBy('name')
            ->get();

        $constructionStatuses = \App\Models\PropertyConstructionStatus::where('company_id', user()->company_id)
            ->select('name', 'label')
            ->orderBy('label')
            ->get();

        $primaryCategories = \App\Models\PropertyPrimaryCategory::where('company_id', user()->company_id)
            ->select('name', 'label')
            ->orderBy('label')
            ->get();

        // For Inertia page render
        // if (!$request->ajax() && !$request->wantsJson()) {
            return Inertia::render('DeveloperProjects/Index', [
                'pageTitle' => 'Construction Projects',
                'projects' => $projects,
                'developers' => $developers,
                'locations' => $locations,
                'constructionStatuses' => $constructionStatuses,
                'primaryCategories' => $primaryCategories,
                'filters' => $request->only([
                    'search', 'location_id', 'sort',
                    'developer_id', 'construction_status', 'primary_category',
                    'payment_plan_duration', 'price_min', 'price_max',
                ]),
            ]);
        // }

        // // For AJAX/API requests
        // return Reply::successWithData('Developer projects fetched successfully', [
        //     'projects' => $projects,
        // ]);
    }

    /**
     * Get a single developer project with all related data.
     */
    public function show(Request $request, $id)
    {
        $project = DeveloperProject::with(['location', 'exposeConfig', 'properties.assets', 'developer', 'assets', 'unitTypes.assets', 'unitTypes.offers', 'offers'])
            ->withCount('properties')
            ->where('company_id', user()->company_id)
            ->findOrFail($id);

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
            $developerProjects = DeveloperProject::with([
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
                ->where('id', '!=', $project->id)
                ->orderBy('created_at', 'desc')
                ->get();
        }

        return Inertia::render('DeveloperProjects/Show', [
            'pageTitle' => $project->name,
            'project' => $project,
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

        // Handle location with canonical city+area uniqueness.
        $locationId = $request->project_location_id;
        if ($request->filled('city') || $request->filled('area') || $request->filled('address')) {
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

        $project = DeveloperProject::create([
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
        ]);

        return Reply::successWithData('Construction project created successfully', [
            'data' => $project->load(['location', 'developer']),
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

        // Handle location with canonical city+area uniqueness.
        if ($request->hasAny(['city', 'area', 'address', 'latitude', 'longitude', 'map_url'])) {
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
            'facilities', 'distances',
        ];

        $updatePayload = $request->only($updateFields);

        // Protect existing facilities from being cleared when the field is
        // omitted by a collapsed form section on the frontend.
        if (!$request->has('facilities')) {
            unset($updatePayload['facilities']);
        }

        $project->update($updatePayload);

        return Reply::successWithData('Construction project updated successfully', [
            'data' => $project->fresh(['location', 'exposeConfig', 'developer']),
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
        $projects = DeveloperProject::where('company_id', user()->company_id)
            ->select('id', 'name', 'developer_id', 'project_location_id')
            ->with(['location:id,name', 'developer:id,name'])
            ->orderBy('name')
            ->get();

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
