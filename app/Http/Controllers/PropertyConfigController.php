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
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

/**
 * CRUD controller for all 9 property lookup/configuration tables.
 *
 * Routes accept a {type} parameter that maps to the model:
 *   property-types, sub-types, primary-categories, view-types,
 *   title-deed-types, exterior-features, interior-features,
 *   floor-types, deed-statuses
 */
class PropertyConfigController extends AccountBaseController
{
    /**
     * Map route type slugs to model classes.
     */
    private const TYPE_MAP = [
        'property-types'      => PropertyType::class,
        'sub-types'           => PropertySubType::class,
        'primary-categories'  => PropertyPrimaryCategory::class,
        'view-types'          => PropertyViewType::class,
        'title-deed-types'    => PropertyTitleDeedType::class,
        'exterior-features'   => PropertyExteriorFeature::class,
        'interior-features'   => PropertyInteriorFeature::class,
        'floor-types'         => PropertyFloorType::class,
        'deed-statuses'       => PropertyDeedStatus::class,
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
        ]);

        $item->update($validated);

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
