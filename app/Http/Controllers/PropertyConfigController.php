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

        $rules = [
            'name'        => [
                'nullable',
                'string',
                'max:255',
            ],
            'label'       => 'required|string|max:255',
            'description' => 'nullable|string|max:1000',
            'parent_type' => 'nullable|string|max:255',
            'category'    => 'nullable|string|max:255',
            'city_id'     => 'nullable|integer|exists:property_cities,id',
        ];

        // Cities support default distance values
        if ($type === 'cities') {
            $rules['default_distances']              = 'nullable|array';
            $rules['default_distances.market_km']    = 'nullable|numeric|min:0';
            $rules['default_distances.hospital_km']  = 'nullable|numeric|min:0';
            $rules['default_distances.airport_km']   = 'nullable|numeric|min:0';
            $rules['default_distances.school_km']    = 'nullable|numeric|min:0';
            $rules['default_distances.beach_km']     = 'nullable|numeric|min:0';
            $rules['default_distances.sea_km']       = 'nullable|numeric|min:0';
        }

        $validated = $request->validate($rules);

        // Auto-generate name from label if not provided
        $name = !empty($validated['name'])
            ? $validated['name']
            : \Illuminate\Support\Str::snake(\Illuminate\Support\Str::lower($validated['label']));

        // Validate uniqueness of the resolved name
        $existingCount = $modelClass::where('company_id', user()->company_id)
            ->where('name', $name)
            ->count();

        if ($existingCount > 0) {
            return response()->json([
                'message' => 'The name has already been taken.',
                'errors'  => ['name' => ['The name "' . $name . '" already exists. Please use a different label.']],
            ], 422);
        }

        $fillable = [
            'company_id'  => user()->company_id,
            'name'        => $name,
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

        // Only PropertyCity has default_distances
        if ($type === 'cities' && array_key_exists('default_distances', $validated)) {
            $fillable['default_distances'] = $validated['default_distances'];
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
        $item = $modelClass::findOrFail($id);

        $rules = [
            'label'       => 'sometimes|string|max:255',
            'description' => 'nullable|string|max:1000',
            'parent_type' => 'nullable|string|max:255',
            'category'    => 'nullable|string|max:255',
            'city_id'     => 'nullable|integer|exists:property_cities,id',
        ];

        // Cities support default distance values
        if ($type === 'cities') {
            $rules['default_distances']              = 'nullable|array';
            $rules['default_distances.market_km']    = 'nullable|numeric|min:0';
            $rules['default_distances.hospital_km']  = 'nullable|numeric|min:0';
            $rules['default_distances.airport_km']   = 'nullable|numeric|min:0';
            $rules['default_distances.school_km']    = 'nullable|numeric|min:0';
            $rules['default_distances.beach_km']     = 'nullable|numeric|min:0';
            $rules['default_distances.sea_km']       = 'nullable|numeric|min:0';
        }

        $validated = $request->validate($rules);

        // Name is immutable after creation — strip it if sent
        $updateData = $validated;
        unset($updateData['name']);
        if ($type !== 'sub-types') {
            unset($updateData['parent_type']);
        }
        if ($type !== 'property-types') {
            unset($updateData['category']);
        }
        if ($type !== 'areas') {
            unset($updateData['city_id']);
        }
        if ($type !== 'cities') {
            unset($updateData['default_distances']);
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
     * Bulk-assign a primary category to multiple property types.
     */
    public function bulkUpdateCategory(Request $request)
    {
        $validated = $request->validate([
            'ids'      => 'required|array|min:1',
            'ids.*'    => 'integer|exists:property_types,id',
            'category' => 'required|string|max:255',
        ]);

        PropertyType::whereIn('id', $validated['ids'])
            ->update(['category' => $validated['category']]);

        return Reply::success('Category assigned to ' . count($validated['ids']) . ' property type(s)');
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
