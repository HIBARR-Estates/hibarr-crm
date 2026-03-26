<?php

namespace App\Http\Controllers;

use App\Models\DeveloperProject;
use App\Models\DeveloperProjectUnitType;
use App\Models\Property;
use App\Models\Lead;
use App\Helper\Reply;
use App\Services\PdfExpose\ExposeGeneratorService;
use App\Services\PdfExpose\Configuration\ExposeConfiguration;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
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
     * Display a listing of developer projects.
     * 
     * Supports search filtering and returns paginated results with
     * related location and property count data.
     */
    public function index(Request $request)
    {
        $query = DeveloperProject::with(['location', 'exposeConfig', 'developer', 'assets' => function ($q) {
                $q->where('asset_type', 'image')->orderBy('order')->limit(1);
            }])
            ->withCount('properties')
            ->withCount(['properties as sold_properties_count' => function ($q) {
                $q->where('status', Property::STATUS_SOLD);
            }])
            ->where('company_id', user()->company_id);

        // Search by name or description
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('description', 'like', "%{$search}%");
            });
        }

        // Filter by location if provided
        if ($request->filled('location_id')) {
            $query->where('project_location_id', $request->location_id);
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
            default: // newest
                $query->orderBy('created_at', 'desc');
                break;
        }

        $projects = $query->paginate(15);

        // For Inertia page render
        // if (!$request->ajax() && !$request->wantsJson()) {
            return Inertia::render('DeveloperProjects/Index', [
                'pageTitle' => 'Construction Projects',
                'projects' => $projects,
                'filters' => $request->only(['search', 'location_id', 'sort']),
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
        $project = DeveloperProject::with(['location', 'exposeConfig', 'properties.assets', 'developer', 'assets', 'unitTypes.assets'])
            ->withCount('properties')
            ->where('company_id', user()->company_id)
            ->findOrFail($id);

        // Calculate statistics
        $totalProperties = $project->properties->count();
        $soldProperties = $project->properties->where('status', Property::STATUS_SOLD)->count();
        $soldPercentage = $totalProperties > 0 ? round(($soldProperties / $totalProperties) * 100, 1) : 0;

        // Get property types summary with stats
        $propertyTypesSummary = $this->getPropertyTypesSummary($project->properties);

        // Get aggregated facilities from properties
        $facilities = $this->getAggregatedFacilities($project);

        // Get images by tag (exterior, interior, floor_plan/site_plan)
        $imagesByTag = $this->getImagesByTag($project);

        // Get price list by property type
        $priceList = $this->getPriceListByType($project->properties);

        return Inertia::render('DeveloperProjects/Show', [
            'pageTitle' => $project->name,
            'project' => $project,
            'statistics' => [
                'total_properties' => $totalProperties,
                'sold_properties' => $soldProperties,
                'sold_percentage' => $soldPercentage,
                'available_properties' => $project->properties->where('status', Property::STATUS_AVAILABLE)->count(),
                'under_offer_properties' => $project->properties->where('status', Property::STATUS_UNDER_OFFER)->count(),
            ],
            'propertyTypesSummary' => $propertyTypesSummary,
            'facilities' => $facilities,
            'imagesByTag' => $imagesByTag,
            'priceList' => $priceList,
            'unitTypes' => $project->unitTypes->sortBy('order')->values(),
        ]);
    }

    /**
     * Get property types summary with bedroom/bathroom/area/price ranges.
     */
    private function getPropertyTypesSummary($properties)
    {
        $grouped = $properties->groupBy('property_type');
        $summary = [];

        foreach ($grouped as $type => $props) {
            if (empty($type)) continue;

            $bedrooms = $props->pluck('bedrooms')->filter()->map(fn($b) => (int)$b);
            $bathrooms = $props->pluck('bathrooms')->filter();
            $areas = $props->pluck('area')->filter()->map(fn($a) => (float)preg_replace('/[^0-9.]/', '', $a));
            $prices = $props->pluck('price')->filter();

            $summary[] = [
                'type' => $type,
                'count' => $props->count(),
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
        $facilities = collect($project->facilities ?? []);

        // Merge unique facilities from properties' exterior and interior features
        foreach ($project->properties as $property) {
            if (!empty($property->exterior_features)) {
                $facilities = $facilities->merge($property->exterior_features);
            }
            if (!empty($property->interior_features)) {
                $facilities = $facilities->merge($property->interior_features);
            }
        }

        return $facilities->unique()->values()->all();
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
     * Get price list organized by property type.
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

        // Handle location — create or update ProjectLocation if location fields provided
        $locationId = $request->project_location_id;
        if ($request->filled('city') || $request->filled('area') || $request->filled('address')) {
            // The address column is JSON ({street?, state?, country?, postalCode?}).
            // If a plain string is provided, wrap it in the expected structure.
            $address = $request->address;

            if (is_string($address)) {
                $address = ['street' => $address];
            }

            $location = \App\Models\ProjectLocation::create([
                'company_id' => user()->company_id,
                // name is city, area
                'name' => $request->city . ($request->area ? " - {$request->area}" : ''),
                'city' => $request->city, 
                'area' => $request->area,
                'address' => $address,
                'latitude' => $request->latitude,
                'longitude' => $request->longitude,
                'map_url' => $request->map_url,
            ]);
            $locationId = $location->id;
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

        // Handle location — update existing or create new
        if ($request->filled('city') || $request->filled('area') || $request->filled('address')) {
            // The address column is JSON ({street?, state?, country?, postalCode?}).
            // If a plain string is provided, wrap it in the expected structure.
            $address = $request->address;

            if (is_string($address)) {
                $address = ['street' => $address];
            }

            $locationData = [
                'company_id' => user()->company_id,
                'city' => $request->city,
                'area' => $request->area,
                'address' => $address,
                'latitude' => $request->latitude,
                'longitude' => $request->longitude,
                'map_url' => $request->map_url,
            ];

            if ($project->project_location_id) {
                $project->location()->update($locationData);
            } else {
                $location = \App\Models\ProjectLocation::create($locationData);
                $request->merge(['project_location_id' => $location->id]);
            }
        }

        $updateFields = [
            'name', 'reference_code', 'description', 'developer_id', 'project_location_id',
            'google_drive_link', 'availability_link', 'starting_price',
            'primary_categories', 'title_deed_type', 'unit_types',
            'number_of_units', 'number_of_blocks', 'project_total_area_sqm',
            'construction_status', 'completion_date', 'number_of_phases',
            'furniture_package', 'rental_guarantee', 'payment_plan',
            'facilities', 'distances',
        ];

        $project->update($request->only($updateFields));

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
        $project = DeveloperProject::with(['developer', 'location', 'assets', 'unitTypes.assets'])
            ->where('company_id', user()->company_id)
            ->findOrFail($id);

        $clientData = [];
        if ($request->filled('client_name')) {
            $clientData['client_name'] = $request->input('client_name');
        }
        if ($request->filled('client_email')) {
            $clientData['client_email'] = $request->input('client_email');
        }

        $config = ExposeConfiguration::fromDeveloperProject($project, 'project-expose-template', $clientData);

        return $this->exposeService->generate($config);
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

        $warnings = $this->exposeService->checkWarnings($config);

        return Reply::successWithData('Validation complete', [
            'warnings' => $warnings,
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
        // Verify project belongs to company
        DeveloperProject::where('company_id', user()->company_id)
            ->findOrFail($projectId);

        $unitType = DeveloperProjectUnitType::with(['project.developer', 'project.location', 'project.assets', 'assets'])
            ->where('developer_project_id', $projectId)
            ->findOrFail($unitTypeId);

        $clientData = [];
        if ($request->filled('client_name')) {
            $clientData['client_name'] = $request->input('client_name');
        }
        if ($request->filled('client_email')) {
            $clientData['client_email'] = $request->input('client_email');
        }

        $config = ExposeConfiguration::fromUnitType($unitType, 'expose-template', $clientData);

        return $this->exposeService->generate($config);
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

        $warnings = $this->exposeService->checkWarnings($config);

        return Reply::successWithData('Validation complete', [
            'warnings' => $warnings,
        ]);
    }
}
