<?php

namespace App\Http\Controllers;

use App\Models\DeveloperProject;
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
        $query = DeveloperProject::with(['location', 'exposeConfig', 'developer'])
            ->withCount('properties')
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

        $projects = $query->orderBy('created_at', 'desc')->paginate(15);

        // For Inertia page render
        // if (!$request->ajax() && !$request->wantsJson()) {
            return Inertia::render('DeveloperProjects/Index', [
                'pageTitle' => 'Developer Projects',
                'projects' => $projects,
                'filters' => $request->only(['search', 'location_id']),
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
        $project = DeveloperProject::with(['location', 'exposeConfig', 'properties.assets', 'developer', 'assets'])
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
        $facilities = collect();

        // Get facilities from project's expose config if exists
        if ($project->exposeConfig && !empty($project->exposeConfig->grouped_images['facilities'] ?? [])) {
            // Project-level facilities from config
        }

        // Get unique facilities from properties' exterior and interior features
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
            'description' => 'nullable|string',
            'developer_id' => 'nullable|exists:developers,id',
            'project_location_id' => 'nullable|exists:project_locations,id',
        ]);

        if ($validator->fails()) {
            return Reply::error($validator->errors()->first());
        }

        $project = DeveloperProject::create([
            'company_id' => user()->company_id,
            'developer_id' => $request->developer_id,
            'name' => $request->name,
            'description' => $request->description,
            'project_location_id' => $request->project_location_id,
        ]);

        return Reply::successWithData('Developer project created successfully', [
            'project' => $project->load(['location', 'developer']),
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
            'description' => 'nullable|string',
            'developer_id' => 'nullable|exists:developers,id',
            'project_location_id' => 'nullable|exists:project_locations,id',
        ]);

        if ($validator->fails()) {
            return Reply::error($validator->errors()->first());
        }

        $project->update($request->only(['name', 'description', 'developer_id', 'project_location_id']));

        return Reply::successWithData('Developer project updated successfully', [
            'project' => $project->fresh(['location', 'exposeConfig', 'developer']),
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

        return Reply::success('Developer project deleted successfully');
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

        return Reply::successWithData('Developer projects fetched', [
            'projects' => $projects,
        ]);
    }

    /**
     * Generate expose PDF for a developer project.
     * 
     * Accepts selected property IDs and lead information (either existing lead_id
     * or lead_data for creating a new lead).
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
}
