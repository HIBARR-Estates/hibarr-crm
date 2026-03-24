<?php

namespace App\Http\Controllers;

use App\Models\DeveloperProject;
use App\Models\DeveloperProjectUnitType;
use App\Helper\Reply;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

/**
 * DeveloperProjectUnitTypeController
 * 
 * Handles CRUD operations for unit types within developer projects.
 * Each project can have multiple unit types with detailed specifications,
 * features, pricing, and legal information.
 */
class DeveloperProjectUnitTypeController extends Controller
{
    /**
     * List all unit types for a project.
     */
    public function index(Request $request, $projectId)
    {
        $project = DeveloperProject::where('company_id', user()->company_id)
            ->findOrFail($projectId);

        $unitTypes = $project->unitTypes()
            ->ordered()
            ->with('assets')
            ->get();

        return Reply::successWithData('Unit types retrieved', [
            'unit_types' => $unitTypes,
        ]);
    }

    /**
     * Store a new unit type for a project.
     */
    public function store(Request $request, $projectId)
    {
        $project = DeveloperProject::where('company_id', user()->company_id)
            ->findOrFail($projectId);

        $validator = Validator::make($request->all(), $this->validationRules());

        if ($validator->fails()) {
            return Reply::error($validator->errors()->first());
        }

        $unitType = new DeveloperProjectUnitType([
            'company_id' => user()->company_id,
            'developer_project_id' => $project->id,
            ...$request->only($this->fillableFields()),
        ]);

        // Auto-generate reference code if not provided
        if (!$request->filled('reference_code')) {
            $unitType->reference_code = $unitType->generateReferenceCode();
        }

        $unitType->save();

        return Reply::successWithData('Unit type created successfully', [
            'unit_type' => $unitType->load('assets'),
        ]);
    }

    /**
     * Show a single unit type.
     */
    public function show($projectId, $unitTypeId)
    {
        $project = DeveloperProject::where('company_id', user()->company_id)
            ->findOrFail($projectId);

        $unitType = $project->unitTypes()
            ->with('assets')
            ->findOrFail($unitTypeId);

        return Reply::successWithData('Unit type retrieved', [
            'unit_type' => $unitType,
        ]);
    }

    /**
     * Update a unit type.
     */
    public function update(Request $request, $projectId, $unitTypeId)
    {
        $project = DeveloperProject::where('company_id', user()->company_id)
            ->findOrFail($projectId);

        $unitType = $project->unitTypes()->findOrFail($unitTypeId);
        $incoming = $request->only($this->fillableFields());

        $validator = Validator::make($request->all(), $this->validationRules(true));

        if ($validator->fails()) {
            return Reply::error($validator->errors()->first());
        }

        $unitType->update($incoming);

        return Reply::successWithData('Unit type updated successfully', [
            'unit_type' => $unitType->fresh('assets'),
        ]);
    }

    /**
     * Delete a unit type (soft delete).
     */
    public function destroy($projectId, $unitTypeId)
    {
        $project = DeveloperProject::where('company_id', user()->company_id)
            ->findOrFail($projectId);

        $unitType = $project->unitTypes()->findOrFail($unitTypeId);
        $unitType->delete();

        return Reply::success('Unit type deleted successfully');
    }

    /**
     * Reorder unit types for a project.
     */
    public function reorder(Request $request, $projectId)
    {
        $project = DeveloperProject::where('company_id', user()->company_id)
            ->findOrFail($projectId);

        $validator = Validator::make($request->all(), [
            'order' => 'required|array',
            'order.*.id' => 'required|integer',
            'order.*.order' => 'required|integer|min:0',
        ]);

        if ($validator->fails()) {
            return Reply::error($validator->errors()->first());
        }

        foreach ($request->order as $item) {
            $project->unitTypes()
                ->where('id', $item['id'])
                ->update(['order' => $item['order']]);
        }

        return Reply::success('Unit types reordered successfully');
    }

    /**
     * Validation rules for unit type create/update.
     */
    private function validationRules(bool $isUpdate = false): array
    {
        $allPropertyTypes = array_merge(
            array_keys(DeveloperProjectUnitType::RESIDENTIAL_PROPERTY_TYPES),
            array_keys(DeveloperProjectUnitType::COMMERCIAL_PROPERTY_TYPES)
        );

        return [
            'reference_code' => 'nullable|string|max:50',
            'primary_category' => ($isUpdate ? 'sometimes|' : '') . 'required|string|in:residential,commercial',
            'property_type' => 'nullable|string|in:' . implode(',', $allPropertyTypes),
            'unit_style' => 'nullable|array',
            'unit_style.*' => 'string|in:' . implode(',', array_keys(DeveloperProjectUnitType::UNIT_STYLES)),
            'view_types' => 'nullable|array',
            'view_types.*' => 'string|in:' . implode(',', array_keys(DeveloperProjectUnitType::VIEW_TYPES)),
            'furniture_status' => 'nullable|string|in:' . implode(',', array_keys(DeveloperProjectUnitType::FURNITURE_STATUSES)),
            'starting_price' => 'nullable|numeric|min:0',
            'currency' => 'nullable|string|in:' . implode(',', array_keys(DeveloperProjectUnitType::CURRENCIES)),
            'bedrooms' => 'nullable|integer|min:0|max:8',
            'bathrooms' => 'nullable|integer|min:1|max:5',
            'floor' => 'nullable|string|in:' . implode(',', array_keys(DeveloperProjectUnitType::FLOOR_OPTIONS)),
            'floors_in_building' => 'nullable|integer|min:0|max:20',
            'total_area_sqm' => 'nullable|numeric|min:0',
            'living_area_sqm' => 'nullable|numeric|min:0',
            'terrace_balcony_sqm' => 'nullable|numeric|min:0',
            'plot_size_sqm' => 'nullable|numeric|min:0',
            'completion_date' => 'nullable|date',
            'outside_features' => 'nullable|array',
            'outside_features.*' => 'string|in:' . implode(',', array_keys(DeveloperProjectUnitType::OUTSIDE_FEATURES)),
            'inside_features' => 'nullable|array',
            'inside_features.*' => 'string|in:' . implode(',', array_keys(DeveloperProjectUnitType::INSIDE_FEATURES)),
            'description' => 'nullable|string',
            'military_base_distance_km' => 'nullable|numeric|min:0',
            'has_restrictions' => 'nullable|boolean',
            'restriction_notes' => 'nullable|string',
        ];
    }

    /**
     * Fields that can be mass-assigned from request.
     */
    private function fillableFields(): array
    {
        return [
            'reference_code',
            'primary_category',
            'property_type',
            'unit_style',
            'view_types',
            'furniture_status',
            'starting_price',
            'currency',
            'bedrooms',
            'bathrooms',
            'floor',
            'floors_in_building',
            'total_area_sqm',
            'living_area_sqm',
            'terrace_balcony_sqm',
            'plot_size_sqm',
            'completion_date',
            'outside_features',
            'inside_features',
            'description',
            'military_base_distance_km',
            'has_restrictions',
            'restriction_notes',
        ];
    }
}
