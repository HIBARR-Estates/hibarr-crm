<?php

namespace App\Http\Controllers;

use App\Models\ProjectLocation;
use App\Helper\Reply;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Inertia\Inertia;

/**
 * ProjectLocationController
 * 
 * Handles CRUD operations for project locations.
 * Locations contain address and surrounding area information
 * (attractions, infrastructure, airports) used in expose PDFs.
 */
class ProjectLocationController extends AccountBaseController
{
    public function __construct()
    {
        parent::__construct();
    }

    /**
     * Display a listing of project locations.
     */
    public function index(Request $request)
    {
        $query = ProjectLocation::where('company_id', user()->company_id);

        // Search by name or description
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('description', 'like', "%{$search}%");
            });
        }

        $locations = $query->orderBy('name')->paginate(15);

        // For Inertia page render
        // if (!$request->ajax() && !$request->wantsJson()) {
            return Inertia::render('ProjectLocations/Index', [
                'pageTitle' => 'Project Locations',
                'locations' => $locations,
                'filters' => $request->only(['search']),
            ]);
        // }

        // return Reply::successWithData('Project locations fetched successfully', [
        //     'locations' => $locations,
        // ]);
    }

    /**
     * Get all locations for dropdown selection.
     * Returns minimal data optimized for select inputs.
     */
    public function all()
    {
        $locations = ProjectLocation::where('company_id', user()->company_id)
            ->select('id', 'name', 'address')
            ->orderBy('name')
            ->get()
            ->map(function ($location) {
                return [
                    'id' => $location->id,
                    'name' => $location->name,
                    'full_address' => $location->full_address,
                    'city' => $location->city,
                ];
            });

        return Reply::successWithData('Project locations fetched successfully', [
            'locations' => $locations,
        ]);
    }

    /**
     * Get a single project location with all details.
     */
    public function show(Request $request, $id)
    {
        $location = ProjectLocation::where('company_id', user()->company_id)
            ->findOrFail($id);

        // For Inertia page render
        // if (!$request->ajax() && !$request->wantsJson()) {
            return Inertia::render('ProjectLocations/Show', [
                'pageTitle' => $location->name,
                'location' => $location,
            ]);
        // }

        // return Reply::successWithData('Project location fetched successfully', [
        //     'location' => $location,
        // ]);
    }

    /**
     * Store a new project location.
     * 
     * Validates address structure and JSON array fields before saving.
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'address' => 'nullable|array',
            'address.street' => 'nullable|string|max:255',
            'address.city' => 'nullable|string|max:255',
            'address.state' => 'nullable|string|max:255',
            'address.country' => 'nullable|string|max:255',
            'address.postalCode' => 'nullable|string|max:50',
            'map_url' => 'nullable|url|max:500',
            'attractions' => 'nullable|array',
            'attractions.*.name' => 'required_with:attractions|string',
            'attractions.*.content' => 'nullable|array',
            'attractions.*.images' => 'nullable|array',
            'infrastructure' => 'nullable|array',
            'infrastructure.*.name' => 'required_with:infrastructure|string',
            'infrastructure.*.travelTimeInMin' => 'nullable|numeric',
            'infrastructure.*.image' => 'nullable|string',
            'airports' => 'nullable|array',
            'airports.*.name' => 'required_with:airports|string',
            'airports.*.travelTimeInMin' => 'nullable|numeric',
            'airports.*.image' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return Reply::error($validator->errors()->first());
        }

        $location = ProjectLocation::create([
            'company_id' => user()->company_id,
            'name' => $request->name,
            'description' => $request->description,
            'address' => $request->address,
            'map_url' => $request->map_url,
            'attractions' => $request->attractions ?? [],
            'infrastructure' => $request->infrastructure ?? [],
            'airports' => $request->airports ?? [],
        ]);

        return Reply::successWithData('Project location created successfully', [
            'location' => $location,
        ]);
    }

    /**
     * Update a project location.
     */
    public function update(Request $request, $id)
    {
        $location = ProjectLocation::where('company_id', user()->company_id)
            ->findOrFail($id);

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'address' => 'nullable|array',
            'address.street' => 'nullable|string|max:255',
            'address.city' => 'nullable|string|max:255',
            'address.state' => 'nullable|string|max:255',
            'address.country' => 'nullable|string|max:255',
            'address.postalCode' => 'nullable|string|max:50',
            'map_url' => 'nullable|url|max:500',
            'attractions' => 'nullable|array',
            'infrastructure' => 'nullable|array',
            'airports' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return Reply::error($validator->errors()->first());
        }

        $location->update($request->only([
            'name',
            'description',
            'address',
            'map_url',
            'attractions',
            'infrastructure',
            'airports',
        ]));

        return Reply::successWithData('Project location updated successfully', [
            'location' => $location->fresh(),
        ]);
    }

    /**
     * Delete a project location.
     * 
     * Prevents deletion if the location is currently assigned to a project.
     */
    public function destroy($id)
    {
        $location = ProjectLocation::where('company_id', user()->company_id)
            ->findOrFail($id);

        // Check if location is in use by any project
        if ($location->isInUse()) {
            return Reply::error('Cannot delete location that is assigned to a project. Please reassign the project first.');
        }

        $location->delete();

        return Reply::success('Project location deleted successfully');
    }
}
