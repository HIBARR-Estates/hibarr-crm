<?php

namespace App\Http\Controllers;

use App\Models\Deal;
use App\Models\DeveloperProject;
use App\Services\DealPropertyService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DealPropertyController extends AccountBaseController
{
    public function __construct(private DealPropertyService $service)
    {
        parent::__construct();
    }

    /**
     * List properties attached to a deal.
     */
    public function index(Deal $deal): JsonResponse
    {
        $properties = $this->service->getAttachedProperties($deal);

        return response()->json([
            'status' => 'success',
            'data' => $properties,
        ]);
    }

    /**
     * Attach an existing property or create from unit type.
     */
    public function store(Request $request, Deal $deal): JsonResponse
    {
        if ($request->has('property_id')) {
            $request->validate([
                'property_id' => 'required|integer|exists:properties,id',
            ]);

            $result = $this->service->attachExistingProperty($deal, $request->input('property_id'));
        } elseif ($request->has('unit_type_id')) {
            $request->validate([
                'unit_type_id'      => 'required|integer|exists:developer_project_unit_types,id',
                'price'             => 'nullable|numeric|min:0',
                'floor_number'      => 'nullable|string',
                'view_types'        => 'nullable|array',
                'view_types.*'      => 'string',
                'outside_features'  => 'nullable|array',
                'outside_features.*' => 'string',
                'inside_features'   => 'nullable|array',
                'inside_features.*' => 'string',
                'offer_ids'         => 'nullable|array',
                'offer_ids.*'       => 'integer|exists:offers,id',
            ]);

            $overrides = $request->only([
                'price', 'floor_number', 'view_types',
                'outside_features', 'inside_features',
            ]);

            $result = $this->service->createFromUnitType(
                $deal,
                $request->input('unit_type_id'),
                $overrides,
                $request->input('offer_ids', [])
            );
        } else {
            return response()->json([
                'status' => 'fail',
                'message' => 'Either property_id or unit_type_id is required.',
            ], 422);
        }

        return response()->json($result, $result['status'] === 'success' ? 200 : 422);
    }

    /**
     * Detach a product/property from the deal.
     */
    public function destroy(Deal $deal, int $productId): JsonResponse
    {
        $result = $this->service->detachProperty($deal, $productId);

        return response()->json($result);
    }

    /**
     * Search approved/published properties.
     */
    public function searchProperties(Request $request): JsonResponse
    {
        $request->validate([
            'q' => 'required|string|min:1|max:255',
        ]);

        $properties = $this->service->searchProperties(
            $request->input('q'),
            user()->company_id
        );

        return response()->json([
            'status' => 'success',
            'data' => $properties,
        ]);
    }

    /**
     * Get unit types for a project.
     */
    public function projectUnitTypes(DeveloperProject $project): JsonResponse
    {
        $unitTypes = $this->service->getProjectUnitTypes($project->id, user()->company_id);

        return response()->json([
            'status' => 'success',
            'data' => $unitTypes,
            'project' => [
                'id' => $project->id,
                'name' => $project->name,
                'availability_link' => $project->availability_link,
            ],
        ]);
    }
}
