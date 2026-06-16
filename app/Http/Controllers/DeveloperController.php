<?php

namespace App\Http\Controllers;

use App\Models\Developer;
use App\Models\DeveloperProject;
use App\Helper\Reply;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Inertia\Inertia;

/**
 * DeveloperController
 * 
 * Handles CRUD operations for developers.
 * Developers are entities that own multiple developer projects.
 */
class DeveloperController extends AccountBaseController
{
    public function __construct()
    {
        parent::__construct();
    }

    /**
     * Display a listing of developers.
     * 
     * Returns paginated results with project counts for card display.
     */
    public function index(Request $request)
    {
        $query = Developer::withCount('projects')
            ->where('company_id', user()->company_id);

        // Search by name or description
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('description', 'like', "%{$search}%");
            });
        }

        $developers = $query->orderBy('name')->paginate($request->get('per_page', 40));

        return Inertia::render('Developers/Index', [
            'pageTitle' => 'Developers',
            'developers' => $developers,
            'filters' => $request->only(['search']),
        ]);
    }

    /**
     * Get all developers for dropdown selection.
     * Returns minimal data optimized for select inputs.
     */
    public function all()
    {
        $developers = Developer::where('company_id', user()->company_id)
            ->select('id', 'name', 'logo_url', 'project_list', 'whatsapp_group_link', 'google_drive_link')
            ->orderBy('name')
            ->get();

        return Reply::successWithData('Developers fetched successfully', [
            'developers' => $developers,
        ]);
    }

    /**
     * Get a single developer with their projects.
     */
    public function show(Request $request, $id)
    {
        $developer = Developer::withCount(['projects', 'offers'])
            ->where('company_id', user()->company_id)
            ->findOrFail($id);

        // Get developer's projects with counts
        $projectsQuery = DeveloperProject::with(['location', 'exposeConfig'])
            ->withCount('properties')
            ->where('developer_id', $id)
            ->where('company_id', user()->company_id);

        // Search projects by name
        if ($request->filled('search')) {
            $search = $request->search;
            $projectsQuery->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('description', 'like', "%{$search}%");
            });
        }

        $projects = $projectsQuery->orderBy('created_at', 'desc')->paginate(15);

        // Get developer's offers
        $offers = $developer->offers()
            ->withCount(['dealApplications', 'developerProjects'])
            ->orderBy('created_at', 'desc')
            ->get();

        return Inertia::render('Developers/Show', [
            'pageTitle' => $developer->name,
            'developer' => $developer,
            'projects' => $projects,
            'offers' => $offers,
            'filters' => $request->only(['search']),
        ]);
    }

    /**
     * Store a new developer.
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'logo_url' => 'nullable|url|max:500',
            'description' => 'nullable|string',
            'whatsapp_group_link' => 'nullable|url|max:500',
            'google_drive_link' => 'nullable|url|max:500',
        ]);

        if ($validator->fails()) {
            return Reply::error($validator->errors()->first());
        }

        $developer = Developer::create([
            'company_id' => user()->company_id,
            'name' => $request->name,
            'logo_url' => $request->logo_url,
            'description' => $request->description,
            'whatsapp_group_link' => $request->whatsapp_group_link,
            'google_drive_link' => $request->google_drive_link,
        ]);

        return Reply::successWithData('Developer created successfully', [
            'developer' => $developer,
        ]);
    }

    /**
     * Update a developer.
     */
    public function update(Request $request, $id)
    {
        $developer = Developer::where('company_id', user()->company_id)
            ->findOrFail($id);

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|required|string|max:255',
            'logo_url' => 'nullable|url|max:500',
            'description' => 'nullable|string',
            'whatsapp_group_link' => 'nullable|url|max:500',
            'google_drive_link' => 'nullable|url|max:500',
        ]);

        if ($validator->fails()) {
            return Reply::error($validator->errors()->first());
        }

        $developer->update($request->only(['name', 'logo_url', 'description', 'whatsapp_group_link', 'google_drive_link']));

        return Reply::successWithData('Developer updated successfully', [
            'developer' => $developer->fresh(),
        ]);
    }

    /**
     * Delete a developer.
     * 
     * Soft deletes the developer. Projects assigned to this developer
     * will have their developer_id set to null (handled by FK constraint).
     */
    public function destroy($id)
    {
        $developer = Developer::where('company_id', user()->company_id)
            ->findOrFail($id);

        // Optionally unassign projects first (FK constraint handles this with nullOnDelete)
        DeveloperProject::where('developer_id', $id)
            ->update(['developer_id' => null]);

        $developer->delete();

        return Reply::success('Developer deleted successfully');
    }

    /**
     * Assign projects to a developer.
     * 
     * @param Request $request Contains project_ids array
     * @param int $id Developer ID
     */
    public function assignProjects(Request $request, $id)
    {
        $developer = Developer::where('company_id', user()->company_id)
            ->findOrFail($id);

        $validator = Validator::make($request->all(), [
            'project_ids' => 'required|array',
            'project_ids.*' => 'exists:developer_projects,id',
        ]);

        if ($validator->fails()) {
            return Reply::error($validator->errors()->first());
        }

        $count = DeveloperProject::whereIn('id', $request->project_ids)
            ->where('company_id', user()->company_id)
            ->update(['developer_id' => $id]);

        return Reply::successWithData("$count projects assigned successfully", [
            'developer' => $developer->fresh()->loadCount('projects'),
            'assigned_count' => $count,
        ]);
    }

    /**
     * Remove projects from a developer.
     * 
     * @param Request $request Contains project_ids array
     * @param int $id Developer ID
     */
    public function removeProjects(Request $request, $id)
    {
        $developer = Developer::where('company_id', user()->company_id)
            ->findOrFail($id);

        $validator = Validator::make($request->all(), [
            'project_ids' => 'required|array',
            'project_ids.*' => 'exists:developer_projects,id',
        ]);

        if ($validator->fails()) {
            return Reply::error($validator->errors()->first());
        }

        $count = DeveloperProject::whereIn('id', $request->project_ids)
            ->where('developer_id', $id)
            ->update(['developer_id' => null]);

        return Reply::successWithData("$count projects removed successfully", [
            'developer' => $developer->fresh()->loadCount('projects'),
            'removed_count' => $count,
        ]);
    }
}
