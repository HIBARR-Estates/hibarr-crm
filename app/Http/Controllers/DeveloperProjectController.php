<?php

namespace App\Http\Controllers;

use App\Models\DeveloperProject;
use App\Models\Property;
use App\Helper\Reply;
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
    public function __construct()
    {
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
        $query = DeveloperProject::with(['location', 'exposeConfig'])
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
        $project = DeveloperProject::with(['location', 'exposeConfig', 'properties'])
            ->withCount('properties')
            ->where('company_id', user()->company_id)
            ->findOrFail($id);

        // For Inertia page render
        // if (!$request->ajax() && !$request->wantsJson()) {
            return Inertia::render('DeveloperProjects/Show', [
                'pageTitle' => $project->name,
                'project' => $project,
            ]);
        // }

        // return Reply::successWithData('Developer project fetched successfully', [
        //     'project' => $project,
        // ]);
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
            'project_location_id' => 'nullable|exists:project_locations,id',
        ]);

        if ($validator->fails()) {
            return Reply::error($validator->errors()->first());
        }

        $project = DeveloperProject::create([
            'company_id' => user()->company_id,
            'name' => $request->name,
            'description' => $request->description,
            'project_location_id' => $request->project_location_id,
        ]);

        return Reply::successWithData('Developer project created successfully', [
            'project' => $project->load(['location']),
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
            'project_location_id' => 'nullable|exists:project_locations,id',
        ]);

        if ($validator->fails()) {
            return Reply::error($validator->errors()->first());
        }

        $project->update($request->only(['name', 'description', 'project_location_id']));

        return Reply::successWithData('Developer project updated successfully', [
            'project' => $project->fresh(['location', 'exposeConfig']),
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
            ->select('id', 'name', 'project_location_id')
            ->with('location:id,name')
            ->orderBy('name')
            ->get();

        return Reply::successWithData('Developer projects fetched', [
            'projects' => $projects,
        ]);
    }
}
