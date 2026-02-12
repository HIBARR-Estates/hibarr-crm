<?php

namespace App\Http\Controllers;

use App\Helper\Reply;
use App\Models\PropertyType;
use App\Models\PropertySubType;
use App\Models\PropertyPrimaryCategory;
use App\Models\PropertyViewType;
use App\Models\PropertyTitleDeedType;
use App\Models\PropertyExteriorFeature;
use App\Models\PropertyInteriorFeature;
use App\Models\PropertyFloorType;
use App\Models\PropertyDeedStatus;
use App\Models\PropertyConstructionStatus;
use App\Models\PropertyOccupancyType;
use App\Models\PropertyFurnitureStatus;
use App\Models\PropertyHeatingType;
use App\Models\PropertyCity;
use App\Models\PropertySaleType;
use App\Models\PropertyStatus;
use App\Models\PropertyLocationFeature;
use App\Models\PropertyAddOn;
use App\Models\PropertyArea;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

/**
 * CRUD controller for all 19 property lookup/configuration tables.
 *
 * Routes accept a {type} parameter that maps to the model:
 *   property-types, sub-types, primary-categories, view-types,
 *   title-deed-types, exterior-features, interior-features,
 *   floor-types, deed-statuses, construction-statuses, occupancy-types,
 *   furniture-statuses, heating-types, cities, areas, sale-types, statuses,
 *   location-features, add-ons
 */
class PropertyConfigController extends AccountBaseController
{
    /**
     * Map route type slugs to model classes.
     */
    private const TYPE_MAP = [
        'property-types'        => PropertyType::class,
        'sub-types'             => PropertySubType::class,
        'primary-categories'    => PropertyPrimaryCategory::class,
        'view-types'            => PropertyViewType::class,
        'title-deed-types'      => PropertyTitleDeedType::class,
        'exterior-features'     => PropertyExteriorFeature::class,
        'interior-features'     => PropertyInteriorFeature::class,
        'floor-types'           => PropertyFloorType::class,
        'deed-statuses'         => PropertyDeedStatus::class,
        'construction-statuses' => PropertyConstructionStatus::class,
        'occupancy-types'       => PropertyOccupancyType::class,
        'furniture-statuses'    => PropertyFurnitureStatus::class,
        'heating-types'         => PropertyHeatingType::class,
        'cities'                => PropertyCity::class,
        'areas'                 => PropertyArea::class,
        'sale-types'            => PropertySaleType::class,
        'statuses'              => PropertyStatus::class,
        'location-features'     => PropertyLocationFeature::class,
        'add-ons'               => PropertyAddOn::class,
    ];

    public function __construct()
    {
        parent::__construct();
    }

    /**
     * Render the Inertia configuration management page.
     */
    public function page()
    {
        return Inertia::render('Properties/Config', [
            'pageTitle' => 'Property Configuration',
        ]);
    }

    /**
     * List all entries for a given lookup type.
     */
    public function index(string $type)
    {
        $model = $this->resolveModel($type);
        $items = $model::orderBy('name')->get();

        return Reply::successWithData('Lookup items fetched', ['data' => $items, 'type' => $type]);
    }

    /**
     * Create a new lookup entry.
     */
    public function store(Request $request, string $type)
    {
        $modelClass = $this->resolveModel($type);
        $tableName = (new $modelClass)->getTable();

        $validated = $request->validate([
            'name'        => [
                'required',
                'string',
                'max:255',
                Rule::unique($tableName)->where('company_id', user()->company_id),
            ],
            'label'       => 'required|string|max:255',
            'description' => 'nullable|string|max:1000',
            'parent_type' => 'nullable|string|max:255',
            'category'    => 'nullable|string|max:255',
            'city_id'     => 'nullable|integer|exists:property_cities,id',
        ]);

        $fillable = [
            'company_id'  => user()->company_id,
            'name'        => $validated['name'],
            'label'       => $validated['label'],
            'description' => $validated['description'] ?? null,
        ];

        // Only PropertySubType has parent_type
        if ($type === 'sub-types' && isset($validated['parent_type'])) {
            $fillable['parent_type'] = $validated['parent_type'];
        }

        // Only PropertyType has category
        if ($type === 'property-types' && isset($validated['category'])) {
            $fillable['category'] = $validated['category'];
        }

        // Only PropertyArea has city_id
        if ($type === 'areas' && isset($validated['city_id'])) {
            $fillable['city_id'] = $validated['city_id'];
        }

        $item = $modelClass::create($fillable);

        return Reply::successWithData('Lookup item created', ['data' => $item]);
    }

    /**
     * Show a single lookup entry.
     */
    public function show(string $type, int $id)
    {
        $modelClass = $this->resolveModel($type);
        $item = $modelClass::findOrFail($id);

        return Reply::successWithData('Lookup item fetched', ['data' => $item]);
    }

    /**
     * Update a lookup entry.
     */
    public function update(Request $request, string $type, int $id)
    {
        $modelClass = $this->resolveModel($type);
        $tableName = (new $modelClass)->getTable();
        $item = $modelClass::findOrFail($id);

        $validated = $request->validate([
            'name'        => [
                'sometimes',
                'string',
                'max:255',
                Rule::unique($tableName)->where('company_id', user()->company_id)->ignore($id),
            ],
            'label'       => 'sometimes|string|max:255',
            'description' => 'nullable|string|max:1000',
            'parent_type' => 'nullable|string|max:255',
            'category'    => 'nullable|string|max:255',
            'city_id'     => 'nullable|integer|exists:property_cities,id',
        ]);

        // Filter out fields not applicable to this type
        $updateData = $validated;
        if ($type !== 'sub-types') {
            unset($updateData['parent_type']);
        }
        if ($type !== 'property-types') {
            unset($updateData['category']);
        }
        if ($type !== 'areas') {
            unset($updateData['city_id']);
        }

        $item->update($updateData);

        return Reply::successWithData('Lookup item updated', ['data' => $item->fresh()]);
    }

    /**
     * Delete a lookup entry.
     */
    public function destroy(string $type, int $id)
    {
        $modelClass = $this->resolveModel($type);
        $item = $modelClass::findOrFail($id);
        $item->delete();

        return Reply::success('Lookup item deleted');
    }

    /**
     * List all available lookup types and their counts.
     */
    public function types()
    {
        $types = [];
        foreach (self::TYPE_MAP as $slug => $modelClass) {
            $types[] = [
                'slug'  => $slug,
                'count' => $modelClass::count(),
            ];
        }

        return Reply::successWithData('Lookup types', ['data' => $types]);
    }

    /**
     * Resolve the model class from the route type slug.
     *
     * @param string $type
     * @return class-string
     */
    private function resolveModel(string $type): string
    {
        if (!isset(self::TYPE_MAP[$type])) {
            abort(404, "Unknown property config type: {$type}");
        }

        return self::TYPE_MAP[$type];
    }
}
