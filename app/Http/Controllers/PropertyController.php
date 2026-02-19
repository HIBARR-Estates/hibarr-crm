<?php

namespace App\Http\Controllers;

use App\Models\Property;
use App\Models\Product;
use App\Models\User;
use App\Http\Requests\Property\StoreRequest;
use App\Http\Requests\Property\UpdateRequest;
use App\Http\Requests\Admin\Employee\ImportRequest;
use App\Http\Requests\Admin\Employee\ImportProcessRequest;
use App\Imports\PropertyImport;
use App\Exports\PropertyExport;
use App\Jobs\ImportPropertyJob;
use App\Helper\Reply;
use App\Traits\ImportExcel;
use App\Exceptions\DuplicatePropertyException;
use App\Services\PropertyDuplicateService;
use App\Models\PropertyPublishRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Session;
use Maatwebsite\Excel\Excel;
use Inertia\Inertia;
use Illuminate\Support\Facades\Log;
use App\Helper\Files;
use App\Services\PdfExpose\ExposeGeneratorService;
use App\Services\PdfExpose\Configuration\ExposeConfiguration;
use App\Services\UnitTypePropertyTransformer;
use App\Models\DeveloperProjectUnitType;
use App\Models\DeveloperProject;
use App\Models\Deal;
use Illuminate\Support\Facades\DB;


class PropertyController extends AccountBaseController
{
    use ImportExcel;
    
    private $excel;
    private $addPropertyPermission;
    private $viewPropertyPermission;
    private $editPropertyPermission;
    private $deletePropertyPermission;

    public function __construct(Excel $excel, private ExposeGeneratorService $exposeService)
    {
        $this->excel = $excel;
        parent::__construct();
        
        $this->middleware(function ($request, $next) {
            $this->addPropertyPermission = user()->permission('add_products');
            $this->viewPropertyPermission = user()->permission('view_products');
            $this->editPropertyPermission = user()->permission('edit_products');
            $this->deletePropertyPermission = user()->permission('delete_products');
            
            return $next($request);
        });
    }

    public function index(Request $request)
    {
        // Get properties with pagination and filtering
        $query = Property::with(['product', 'developerProject.location', 'projectLocation', 'addedBy', 'responsibleAgent']);

        // Apply visibility filter - users see published + their own drafts
        $userId = user()->id;
        $isAdmin = $this->editPropertyPermission === 'all';
        
        if (!$isAdmin) {
            $query->where(function ($q) use ($userId) {
                $q->where('is_published', true)
                  ->orWhere('added_by', $userId)
                  ->orWhere('responsible_agent_id', $userId);
            });
        }

        // Filter by publishing status (for users who can see drafts)
        if ($request->filled('publishing_status') && $request->publishing_status !== 'all') {
            if ($request->publishing_status === 'published') {
                $query->where('is_published', true);
            } elseif ($request->publishing_status === 'draft') {
                $query->where('is_published', false);
            }
        }
        
        // Apply filters if provided
        if ($request->filled('property_type') && $request->property_type !== 'all') {
            $query->where('property_type', $request->property_type);
        }

        // Filter by primary category
        if ($request->filled('primary_category') && $request->primary_category !== 'all') {
            $query->where('primary_category', $request->primary_category);
        }

        // Filter by unit style
        if ($request->filled('unit_style') && $request->unit_style !== 'all') {
            $query->whereJsonContains('unit_style', $request->unit_style);
        }

        // Filter by construction status
        if ($request->filled('construction_status') && $request->construction_status !== 'all') {
            $query->where('construction_status', $request->construction_status);
        }

        // Filter by view types (JSON array contains)
        if ($request->filled('view_types')) {
            $viewTypes = is_array($request->view_types) ? $request->view_types : [$request->view_types];
            foreach ($viewTypes as $viewType) {
                $query->whereJsonContains('view_types', $viewType);
            }
        }

        // Filter by occupancy type
        if ($request->filled('occupancy_type') && $request->occupancy_type !== 'all') {
            $query->where('occupancy_type', $request->occupancy_type);
        }

        // Filter by added_by (property creator)
        if ($request->filled('added_by')) {
            $query->where('added_by', $request->added_by);
        }

        // Filter by responsible_agent_id
        if ($request->filled('responsible_agent_id')) {
            $query->where('responsible_agent_id', $request->responsible_agent_id);
        }

        if ($request->filled('sale_type') && $request->sale_type !== 'all') {
            $query->where('sale_type', $request->sale_type);
        }

        if ($request->filled('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        }

        // Filter by developer project
        if ($request->filled('developer_project_id') && $request->developer_project_id !== 'all') {
            $query->where('developer_project_id', $request->developer_project_id);
        }

        // Filter by direct project location
        if ($request->filled('project_location_id') && $request->project_location_id !== 'all') {
            $query->where('project_location_id', $request->project_location_id);
        }

        // Filter by city - search in property's own city OR project location name
        if ($request->filled('city')) {
            $citySearch = $request->city;
            $query->where(function($q) use ($citySearch) {
                $q->where('city', 'like', '%' . $citySearch . '%')
                  ->orWhereHas('developerProject.location', function($locQuery) use ($citySearch) {
                      $locQuery->where('name', 'like', '%' . $citySearch . '%');
                  })
                  ->orWhereHas('projectLocation', function($locQuery) use ($citySearch) {
                      $locQuery->where('name', 'like', '%' . $citySearch . '%');
                  });
            });
        }

        // Filter by project location (searches project location name)
        if ($request->filled('project_location')) {
            $locationSearch = $request->project_location;
            $query->whereHas('developerProject.location', function($q) use ($locationSearch) {
                $q->where('name', 'like', '%' . $locationSearch . '%');
            });
        }

        if ($request->filled('min_price')) {
            $query->where('price', '>=', $request->min_price);
        }

        if ($request->filled('max_price')) {
            $query->where('price', '<=', $request->max_price);
        }

        // Apply search if provided
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->where('title', 'like', '%' . $search . '%')
                  ->orWhere('description', 'like', '%' . $search . '%')
                  ->orWhere('area', 'like', '%' . $search . '%');
            });
        }

        // Apply sorting if specified
        if ($request->filled('sort_by')) {
            $sortBy = $request->sort_by;
            $sortDirection = $request->get('sort_direction', 'asc');
            
            // Validate sort direction
            if (!in_array($sortDirection, ['asc', 'desc'])) {
                $sortDirection = 'asc';
            }
            
            // Map frontend sort fields to database columns
            $sortMapping = [
                'title' => 'title',
                'price' => 'price',
                'created_at' => 'created_at',
            ];
            
            if (isset($sortMapping[$sortBy])) {
                $query->orderBy($sortMapping[$sortBy], $sortDirection);
            } else {
                // Default fallback
                $query->orderBy('created_at', 'desc');
            }
        } else {
            // Default sorting when no sort is specified
            $query->orderBy('created_at', 'desc');
        }

        $perPage = (int) $request->get('per_page', 15) ?: 15;
        $perPage = max(1, min(100, $perPage));

        // ── Source filter: all | properties | unit_types ──
        $source = $request->get('source', 'all');

        if ($source === 'unit_types') {
            // Only return unit types transformed as properties
            $properties = $this->getUnitTypeProperties($request, $perPage);
        } elseif ($source === 'properties') {
            // Only return real properties (default query)
            $properties = $query->paginate($perPage);
        } else {
            // Merge: real properties + unit type rows
            $realProperties = $query->paginate($perPage);
            
            // Append unit types only on page 1 (or when not enough real properties to fill page)
            if ($realProperties->currentPage() === 1) {
                $transformer = new UnitTypePropertyTransformer();
                $unitTypes = DeveloperProjectUnitType::with(['project.location', 'project.developer', 'assets'])
                    ->whereHas('project', function ($q) {
                        $q->where('company_id', user()->company_id);
                    })
                    ->ordered()
                    ->get();
                
                $unitTypeRows = $transformer->transformMany($unitTypes)->all();
                
                // Merge unit type rows after real properties
                $mergedData = array_merge($realProperties->items(), $unitTypeRows);
                
                // Return modified pagination with merged data
                $properties = new \Illuminate\Pagination\LengthAwarePaginator(
                    $mergedData,
                    $realProperties->total() + count($unitTypeRows),
                    $perPage,
                    $realProperties->currentPage(),
                    ['path' => $request->url(), 'query' => $request->query()]
                );
            } else {
                $properties = $realProperties;
            }
        }

        // Get products for property assignment in create drawer
        $products = Product::whereDoesntHave('property')->get();

        // Get products for property assignment
        // $this->products = Product::where('status', 'active')->get();
        // return Inertia::render('Home', [
        //     'greeting' => 'Welcome to Inertia.js with Laravel',
        // ]);
        $this->properties = $properties;
        

        // Get developer projects for assignment (includes developer_id for cascading)
        $developerProjects = \App\Models\DeveloperProject::select('id', 'name', 'developer_id', 'project_location_id')
            ->with(['location:id,name', 'developer:id,name'])
            ->where('company_id', user()->company_id)
            ->orderBy('name')
            ->get();
            
        // Get developers (construction companies) for cascading dropdown
        $developers = \App\Models\Developer::where('company_id', user()->company_id)
            ->select('id', 'name', 'project_list', 'whatsapp_group_link')
            ->orderBy('name')
            ->get();
        
        // Get project locations for direct assignment
        $projectLocations = \App\Models\ProjectLocation::select('id', 'name')
            ->where('company_id', user()->company_id)
            ->get();

        return Inertia::render('Properties/Index', [
            'pageTitle' => 'Properties',
            'properties' => $this->properties,
            'products' => $products,
            'developerProjects' => $developerProjects,
            'projectLocations' => $projectLocations,
            'developers' => $developers,
            'enumValues' => Property::getEnumValues(),
            'filters' => $request->only([
                'search', 'property_type', 'sale_type', 'status', 'city', 
                'min_price', 'max_price', 'developer_project_id', 'project_location',
                'primary_category', 'unit_style', 'construction_status', 
                'publishing_status', 'project_location_id', 'view_types',
                'occupancy_type', 'added_by', 'responsible_agent_id', 'source'
            ]),
            // Lazy-loaded: only fetched when frontend requests it (Construction Projects tab)
            'constructionProjects' => Inertia::lazy(function () use ($request) {
                $cpQuery = \App\Models\DeveloperProject::with(['location', 'exposeConfig', 'developer'])
                    ->withCount(['properties', 'unitTypes'])
                    ->where('company_id', user()->company_id);

                if ($request->filled('cp_search')) {
                    $search = $request->cp_search;
                    $cpQuery->where(function ($q) use ($search) {
                        $q->where('name', 'like', "%{$search}%")
                          ->orWhere('description', 'like', "%{$search}%")
                          ->orWhere('reference_code', 'like', "%{$search}%");
                    });
                }

                if ($request->filled('cp_location_id')) {
                    $cpQuery->where('project_location_id', $request->cp_location_id);
                }

                return $cpQuery->orderBy('created_at', 'desc')->paginate(15, ['*'], 'cp_page');
            }),
        ]);       
    }

    public function create()
    {
        abort_403(!in_array($this->addPropertyPermission, ['all', 'added']));

        $this->pageTitle = __('app.add') . ' ' . __('app.property');
        
        // Get products that don't have properties yet
        $this->products = Product::whereDoesntHave('property')
            ->get();

        if (request()->ajax()) {
            return Inertia::render('Properties/Create', [
                'products' => $this->products
            ]);
        }

        return Inertia::render('Properties/Create', [
            'products' => $this->products
        ]);
    }

    public function store(StoreRequest $request)
    {
        // abort_403(!in_array($this->addPropertyPermission, ['all', 'added']));

        // Check for duplicates before creating
        $duplicateService = app(PropertyDuplicateService::class);
        $propertyData = [
            'company_id' => user()->company_id,
            'developer_project_id' => $request->developer_project_id,
            'property_type' => $request->property_type,
            'city' => $request->city,
            'area' => $request->area,
            'block_name' => $request->block_name,
            'unit_number' => $request->unit_number,
        ];

        try {
            $duplicateService->assertNoDuplicates($propertyData);
        } catch (DuplicatePropertyException $e) {
            if (request()->expectsJson()) {
                return Reply::error($e->getMessage(), null, 422);
            }
            return back()->withErrors(['duplicate' => $e->getMessage()])->withInput();
        }

        // Extract numeric price for Product model (expects simple number)
        $productPrice = 0;
        if ($request->price) {
            if (is_numeric($request->price)) {
                $productPrice = $request->price;
            } elseif (is_array($request->price) && isset($request->price['amount'])) {
                $productPrice = (float) $request->price['amount'];
            } elseif (is_string($request->price)) {
                $decoded = json_decode($request->price, true);
                if (is_array($decoded) && isset($decoded['amount'])) {
                    $productPrice = (float) $decoded['amount'];
                }
            }
        }

        // Generate a default product name if title is not provided
        $productName = $request->title;
        if (empty($productName)) {
            // Create a descriptive name from property type, city, and area
            $nameParts = [];
            if ($request->property_type) {
                $nameParts[] = $request->property_type;
            }
            if ($request->city) {
                $nameParts[] = 'in ' . $request->city;
            }
            if ($request->area) {
                $nameParts[] = '(' . $request->area . ')';
            }
            $productName = !empty($nameParts) ? implode(' ', $nameParts) : 'Property ' . now()->format('Y-m-d H:i:s');
        }

        // create the product first, and then attach the product_id to property
        $product = Product::create([
                    'name' => $productName,
                    'price' => $productPrice,
                    'description' => $request->description ?? '',
                    'allow_purchase' => $request->status == Property::STATUS_AVAILABLE ? 1 : 0, //TODO: Reach out to Team lead to confirm business specifications
                    'company_id' => user()->company_id,
                    'added_by' => user()->id,
                    'unit_id' => 1, // TODO: Get the property unit_id (i.e unit_type) to be assocuated with property
        ]);

        // TODO: Create a property observer, so once the the product is updated, the product has the necessary fields updated

        $property = new Property();
        $property->company_id = user()->company_id;
        $property->added_by = user()->id;
        $property->product_id = $product->id;
        $property->developer_project_id = $request->developer_project_id;
        $property->developer_project_unit_type_id = $request->developer_project_unit_type_id;
        $property->property_type = $request->property_type;
        $property->sale_type = $request->sale_type;
        $property->unit_style = $request->unit_style;
        $property->primary_category = $request->primary_category;
        $property->construction_status = $request->construction_status;
        
        $property->price = $this->normalizePrice($request->price);
        
        $property->minimal_rental_period = $request->minimal_rental_period;
        $property->rent_payment_interval = $request->rent_payment_interval;
        $property->title_deed_type = $request->title_deed_type;
        $property->title_deed_stage = $request->title_deed_stage;
        $property->status = $request->status ?? Property::STATUS_AVAILABLE;
        $property->city = $request->city ?? '';
        $property->map = $request->map;
        $property->area = $request->area;
        $property->address = $request->address;
        $property->latitude = $request->latitude;
        $property->longitude = $request->longitude;
        $property->land_size = $request->land_size;
        $property->land_size_donum = $request->land_size_donum;
        $property->living_area_sqm = $request->living_area_sqm;
        $property->gross_sqm = $request->gross_sqm;
        $property->living_room = $request->living_room;
        $property->bedrooms = $request->bedrooms;
        $property->bathrooms = $request->bathrooms;
        $property->rooms = $request->rooms;
        $property->floor_number = $request->floor_number;
        $property->floors_in_building = $request->floors_in_building;
        $property->balcony_count = $request->balcony_count;
        $property->balcony_net_sqm = $request->balcony_net_sqm;
        $property->building_age = $request->building_age;
        $property->furniture_status = $request->furniture_status;
        $property->heating_type = $request->heating_type;
        $property->within_site = $request->has('within_site') || $request->within_site;
        $property->block_name = $request->block_name;
        $property->unit_number = $request->unit_number;
        $property->exterior_features = $request->exterior_features ? (is_array($request->exterior_features) ? $request->exterior_features : json_decode($request->exterior_features, true)) : [];
        $property->interior_features = $request->interior_features ? (is_array($request->interior_features) ? $request->interior_features : json_decode($request->interior_features, true)) : [];
        $property->location_features = $request->location_features ? (is_array($request->location_features) ? $request->location_features : json_decode($request->location_features, true)) : [];
        $property->title = $request->title;
        $property->description = $request->description;
        $property->video_url = $request->video_url;
        $property->tour_360_url = $request->tour_360_url;
        $property->photos = $request->photos ? (is_array($request->photos) ? $request->photos : json_decode($request->photos, true)) : [];
        $property->add_ons = $request->add_ons ? (is_array($request->add_ons) ? $request->add_ons : json_decode($request->add_ons, true)) : [];
        
        // New fields: Physical Attributes
        $property->total_area_sqm = $request->total_area_sqm;
        $property->plot_size_sqm = $request->plot_size_sqm;
        $property->floor = $request->floor;

        // New fields: Legal Info
        $property->has_restrictions = $request->boolean('has_restrictions');
        $property->restriction_notes = $request->restriction_notes;
        $property->deed_status = $request->deed_status;

        // New fields: Financial Information
        $property->price_to_owner = $request->price_to_owner;
        $property->hibarr_price = $request->hibarr_price;
        $property->commission_agreement_signed = $request->boolean('commission_agreement_signed');

        // New fields: Notes
        $property->general_notes = $request->general_notes;

        // Associated construction company fields
        $property->associated_construction_company = $request->associated_construction_company;
        $property->associated_construction_company_project = $request->associated_construction_company_project;

        // Swap fields
        $property->open_to_swap = $request->boolean('open_to_swap');
        $property->swap_notes = $request->swap_notes;

        // Distances (merge into existing distances JSON)
        if ($request->has('distances')) {
            $property->distances = $request->distances;
        }

        // Legal info with tax_info (merge into existing legal_info JSON)
        if ($request->has('legal_info')) {
            $property->legal_info = $request->legal_info;
        }

        // Documents checklist
        if ($request->has('documents_checklist')) {
            $property->documents_checklist = $request->documents_checklist;
        }

        $property->save();



        if (request()->expectsJson()) {
            return Reply::successWithData(__('messages.propertySaved'), ['property' => $property, 'redirectUrl' => route('properties.index')]);
        }

        return back()->with([
            'success' => true,
            'message' => __('messages.propertySaved'),
            'property' => $property,
            'redirectUrl' => route('properties.index')
        ]);
    }

    public function show($id)
    {
        $this->property = Property::with(['product', 'developerProject.location', 'assets' => function($query) {
            $query->orderBy('order')->orderBy('created_at', 'desc');
        }])->findOrFail($id);

        return $this->renderPropertyShow($this->property);
    }

    /**
     * Show property by slug. Returns the same response as show($id).
     */
    public function showBySlug(string $slug)
    {
        $property = Property::with(['product', 'developerProject.location', 'assets' => function ($query) {
            $query->orderBy('order')->orderBy('created_at', 'desc');
        }])->where('slug', $slug)->firstOrFail();

        return $this->renderPropertyShow($property);
    }

    /**
     * Render the property show page (shared by show id and show by slug).
     */
    private function renderPropertyShow(Property $property)
    {
        $this->property = $property;
        $canEdit = $this->property->added_by === user()->id || $this->property->responsible_agent_id === user()->id;
        $this->pageTitle = $this->property->title;

        $tasks = $this->property->tasks()
            ->with(['users', 'category', 'boardColumn', 'labels'])
            ->orderBy('id', 'desc')
            ->get();

        $taskCategories = \App\Models\TaskCategory::all();
        $taskLabels = \App\Models\TaskLabelList::all();
        $taskBoardColumns = \App\Models\TaskboardColumn::orderBy('priority')->get();
        $employees = User::allEmployees();
        $projects = \App\Models\Project::all();

        $taskPermissions = [
            'add_tasks' => user()->permission('add_tasks'),
            'edit_tasks' => user()->permission('edit_tasks'),
            'delete_tasks' => user()->permission('delete_tasks'),
            'view_tasks' => user()->permission('view_tasks'),
        ];

        // Data needed by the edit property modal (includes developer_id for cascading)
        $developerProjects = \App\Models\DeveloperProject::select('id', 'name', 'developer_id', 'project_location_id')
            ->with(['location:id,name', 'developer:id,name'])
            ->where('company_id', user()->company_id)
            ->orderBy('name')
            ->get();

        // Get developers (construction companies) for cascading dropdown
        $developers = \App\Models\Developer::where('company_id', user()->company_id)
            ->select('id', 'name', 'project_list', 'whatsapp_group_link')
            ->orderBy('name')
            ->get();

        $projectLocations = \App\Models\ProjectLocation::select('id', 'name')
            ->where('company_id', user()->company_id)
            ->get();

        // Check if there's a pending publish request for this property
        $hasPendingPublishRequest = PropertyPublishRequest::where('property_id', $this->property->id)
            ->pending()
            ->exists();

        return Inertia::render('Properties/Show', [
            'pageTitle' => $this->pageTitle,
            'property' => $this->property,
            'canEdit' => $canEdit,
            'hasPendingPublishRequest' => $hasPendingPublishRequest,
            'tasks' => $tasks,
            'taskCategories' => $taskCategories,
            'taskLabels' => $taskLabels,
            'taskBoardColumns' => $taskBoardColumns,
            'employees' => $employees,
            'projects' => $projects,
            'taskPermissions' => $taskPermissions,
            'enumValues' => Property::getEnumValues(),
            'developerProjects' => $developerProjects,
            'developers' => $developers,
            'projectLocations' => $projectLocations,
        ]);
    }

    public function edit($id)
    {
        $this->property = Property::with(['product', 'developerProject.location'])->findOrFail($id);
        
        // Check permission
        $canEdit = false;
        // switch ($this->editPropertyPermission) {
        //     case 'all':
        //         $canEdit = true;
        //         break;
        //     case 'added':
        //         $canEdit = $this->property->product->added_by == user()->id;
        //         break;
        //     case 'owned':
        //         $canEdit = $this->property->product->assigned_to == user()->id;
        //         break;
        //     case 'both':
        //         $canEdit = $this->property->product->added_by == user()->id || $this->property->product->assigned_to == user()->id;
        //         break;
        // }

        // abort_403(!$canEdit);

        $this->pageTitle = __('app.edit') . ' ' . __('app.property');
        
        // Get products for property assignment
        $this->products = Product::all();

        if (request()->ajax()) {
            return Inertia::render('Properties/Create', [
                'property' => $this->property,
                'products' => $this->products,
                'title' => 'Edit Property',
                'isPage' => true
            ]);
        }

        return Inertia::render('Properties/Create', [
            'property' => $this->property,
            'products' => $this->products,
            'title' => 'Edit Property',
            'isPage' => true
        ]);
    }

    public function update(UpdateRequest $request, $id)
    {
        $property = Property::with('product')->findOrFail($id);
        
        // Check permission
        $canEdit = false;
        // switch ($this->editPropertyPermission) {
        //     case 'all':
        //         $canEdit = true;
        //         break;
        //     case 'added':
        //         $canEdit = $property->product->added_by == user()->id;
        //         break;
        //     case 'owned':
        //         $canEdit = $property->product->assigned_to == user()->id;
        //         break;
        //     case 'both':
        //         $canEdit = $property->product->added_by == user()->id || $property->product->assigned_to == user()->id;
        //         break;
        // }

        // abort_403(!$canEdit);

        // Check for duplicates if fingerprint-related fields are being updated
        $fingerprintFields = ['developer_project_id', 'property_type', 'city', 'area', 'block_name', 'unit_number'];
        $hasFingerprintChange = collect($fingerprintFields)->contains(fn($field) => $request->has($field));
        
        if ($hasFingerprintChange) {
            $duplicateService = app(PropertyDuplicateService::class);
            $propertyData = array_merge($property->toArray(), $request->only($fingerprintFields));
            
            try {
                $duplicateService->assertNoDuplicates($propertyData, $property->id);
            } catch (DuplicatePropertyException $e) {
                if (request()->expectsJson()) {
                    return Reply::error($e->getMessage(), null, 422);
                }
                return back()->withErrors(['duplicate' => $e->getMessage()])->withInput();
            }
        }

        // Check if updates are allowed based on current status
        $fieldsToUpdate = $request->only($property->getFillable());
        
        if (isset($fieldsToUpdate['price'])) {
            $fieldsToUpdate['price'] = $this->normalizePrice($fieldsToUpdate['price']);
        }
        
        foreach ($fieldsToUpdate as $field => $value) {
            abort_403(!$property->canUpdateField($field), __('messages.propertyUpdateNotAllowed', ['field' => $field]));
        }

        $property->update($fieldsToUpdate);

        // Auto-revert to draft: if the property was published before this edit,
        // unpublish it so the agent must request re-publishing via a Sales Manager.
        $wasPublished = $property->getOriginal('is_published');
        if ($wasPublished) {
            $property->unpublish();

            // Cancel any pending publish request for this property
            PropertyPublishRequest::where('property_id', $property->id)
                ->pending()
                ->update([
                    'status'           => PropertyPublishRequest::STATUS_REJECTED,
                    'response_message' => 'Auto-cancelled: property was edited after publishing.',
                    'reviewed_at'      => now(),
                ]);
        }

        if (request()->expectsJson()) {
            return Reply::successWithData(__('messages.recordUpdated'), ['property' => $property->fresh()]);
        }

        return back()->with([
            'success' => true,
            'message' => __('messages.recordUpdated'),
            'property' => $property,
            'redirectUrl' => route('properties.index')
        ]);
    }

    public function destroy($id)
    {
        return $this->deleteProperties([$id]);
    }

    // API Methods for JSON responses
    public function apiIndex(Request $request)
    {
        $query = Property::with('product');

        // Apply filters
        if ($request->has('property_type')) {
            $query->byCategory($request->property_type);
        }

        if ($request->has('sale_type')) {
            $query->bySaleType($request->sale_type);
        }

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        if ($request->has('city')) {
            $query->where('city', 'like', '%' . $request->city . '%');
        }

        if ($request->has('min_price')) {
            $query->where('price', '>=', $request->min_price);
        }

        if ($request->has('max_price')) {
            $query->where('price', '<=', $request->max_price);
        }

        $properties = $query->paginate($request->get('per_page', 15));

        return response()->json($properties);
    }

    public function apiShow($id)
    {
        $property = Property::with('product')->findOrFail($id);
        return response()->json($property);
    }

    public function apiStore(StoreRequest $request)
    {
        $property = Property::create($request->validated());
        return response()->json($property, 201);
    }

    public function apiUpdate(UpdateRequest $request, $id)
    {
        $property = Property::findOrFail($id);
        
        // Check if updates are allowed based on current status
        $fieldsToUpdate = $request->validated();
        foreach ($fieldsToUpdate as $field => $value) {
            if (!$property->canUpdateField($field)) {
                return response()->json(['error' => "Field {$field} cannot be updated in current status"], 422);
            }
        }

        $property->update($fieldsToUpdate);
        return response()->json($property);
    }

    public function apiDestroy($id)
    {
        $property = Property::findOrFail($id);
        
        // Don't allow deletion if property is sold or rented
        if ($property->isSold() || $property->isRented()) {
            return response()->json(['error' => 'Property cannot be deleted in current status'], 422);
        }

        $property->delete();
        return response()->json(['message' => 'Property deleted successfully']);
    }

    // Helper method to get property configurations
    public function getPropertyConfigurations()
    {
        return response()->json(Property::getPropertyConfigurations());
    }

    // Helper method to get allowed property types for a category and sale type
    public function getAllowedPropertyTypes(Request $request)
    {
        $category = $request->get('category');
        $saleType = $request->get('sale_type');
        
        $allowedTypes = Property::getAllowedPropertyTypes($category, $saleType);
        
        return response()->json(['allowed_types' => $allowedTypes]);
    }

    // Helper method to get allowed fields for a category
    public function getAllowedFields(Request $request)
    {
        $category = $request->get('category');
        
        $allowedFields = Property::getAllowedFields($category);
        
        return response()->json(['allowed_fields' => $allowedFields]);
    }

    public function applyQuickAction(Request $request)
    {
        $action = $request->action;
        $checkedIds = $request->checkedIds;

        if ($action == 'delete') {
            $this->deleteRecords($checkedIds);
            return back()->with([
                'success' => true,
                'message' => __('messages.deleteSuccess'),
                'reload' => true
            ]);
        }

        if ($action == 'change-status') {
            $this->changeStatus($checkedIds, $request->status);
            return back()->with([
                'success' => true,
                'message' => __('messages.statusUpdated'),
                'reload' => true
            ]);
        }

        return back()->with([
            'error' => true,
            'success' => false,
            'message' => __('messages.selectAction'),
        ]);
    }

    protected function deleteRecords($checkedIds)
    {
        foreach ($checkedIds as $id) {
            $property = Property::findOrFail($id);
            if (!$property->isSold() && !$property->isRented()) {
                $property->delete();
            }
        }
    }

    protected function changeStatus($checkedIds, $status)
    {
        Property::whereIn('id', $checkedIds)->update(['status' => $status]);
    }

    // Asset Management Methods
    
    /**
     * Update property photos
     */
    public function updatePhotos(Request $request, $id)
    {
        $property = Property::findOrFail($id);
        
        $request->validate([
            'photos' => 'required|array',
            'photos.*' => 'file|mimes:jpg,jpeg,png,webp|max:10240', // 10MB max
        ]);

        try {
            // TODO: This ought to be pushed to a job queue for processing
            $assetService = app(\App\Services\PropertyAssetService::class);
            $assetService->updatePhotos($property, $request->file('photos'));
            
            return back()->with([
                'success' => true,
                'message' => __('messages.photosUpdated'),
                'property' => $property,
                'redirectUrl' => route('properties.index')
            ]);
        } catch (\Exception $e) {
            return back()->with([
                'error' => true,
                'success' => false,
                'message' => __('messages.errorOccurred'),
            ]);
        }
    }

    /**
     * Update property video
     */
    public function updateVideo(Request $request, $id)
    {
        $property = Property::findOrFail($id);
        
        $request->validate([
            'video' => 'nullable|file|mimes:mp4,mov,avi,mkv|max:102400', // 100MB max
            'video_url' => 'nullable|url',
        ]);

        try {
            $assetService = app(\App\Services\PropertyAssetService::class);
            
            if ($request->hasFile('video')) {
                $assetService->updateVideo($property, $request->file('video'));
            } elseif ($request->video_url) {
                $assetService->updateVideo($property, $request->video_url);
            }
            
            return back()->with([
                'success' => true,
                'message' => __('messages.propertySaved'),
                'property' => $property,
                'redirectUrl' => route('properties.index')
            ]);
        } catch (\Exception $e) {
            return back()->with([
                'success' => false,
                'message' => __('messages.errorOccurred'),
            ]);
        }
    }

    /**
     * Update property 360 tour
     */
    public function update360Tour(Request $request, $id)
    {
        $property = Property::findOrFail($id);
        
        $request->validate([
            'tour_360' => 'nullable|file|mimes:zip,html,json|max:51200', // 50MB max
            'tour_360_url' => 'nullable|url',
        ]);

        try {
            $assetService = app(\App\Services\PropertyAssetService::class);
            
            if ($request->hasFile('tour_360')) {
                $assetService->update360Tour($property, $request->file('tour_360'));
            } elseif ($request->tour_360_url) {
                $assetService->update360Tour($property, $request->tour_360_url);
            }
            
            return back()->with([
                'success' => true,
                'message' => __('messages.propertySaved'),
                'property' => $property,
                'redirectUrl' => route('properties.index')
            ]);
        } catch (\Exception $e) {
            return back()->with([
                'success' => false,
                'message' => __('messages.errorOccurred'),
            ]);
            
        }
    }

    /**
     * Delete property assets
     */
    public function deleteAssets(Request $request, $id)
    {
        $property = Property::findOrFail($id);
        
        $request->validate([
            'asset_type' => 'required|string|in:photos,video,tour_360,all',
        ]);

        try {
            $assetService = app(\App\Services\PropertyAssetService::class);
            
            switch ($request->asset_type) {
                case 'photos':
                    $assetService->deleteAssets($property, 'photos');
                    $property->update(['photos' => []]);
                    break;
                case 'video':
                    $assetService->deleteAssets($property, 'videos');
                    $property->update(['video_url' => null]);
                    break;
                case 'tour_360':
                    $assetService->deleteAssets($property, 'tours');
                    $property->update(['tour_360_url' => null]);
                    break;
                case 'all':
                    $assetService->deleteAllAssets($property);
                    $property->update([
                        'photos' => [],
                        'video_url' => null,
                        'tour_360_url' => null,
                    ]);
                    break;
            }
            
            return back()->with([
                'success' => true,
                'message' => __('messages.assetsDeleted'),
                'property' => $property,
                'redirectUrl' => route('properties.index')
            ]);
        } catch (\Exception $e) {
            return back()->with([
                'success' => false,
                'message' => __('messages.errorOccurred'),
            ]);
        }
    }

    /**
     * Add a single photo to property
     */
    public function addSinglePhoto(Request $request, $id)
    {
        $property = Property::findOrFail($id);
        
        $request->validate([
            'photo' => 'required|file|mimes:jpg,jpeg,png,webp|max:10240', // 10MB max
        ]);

        try {
            $assetService = app(\App\Services\PropertyAssetService::class);
            $updatedPhotos = $assetService->addSinglePhoto($property, $request->file('photo'));
            

            return back()->with([
                'success' => true,
                'message' => __('messages.photoAdded'),
                'photos' => $updatedPhotos,
                'property' => $property,
                'redirectUrl' => route('properties.index')
            ]);
        } catch (\Exception $e) {
            return back()->with([
                'success' => false,
                'message' => __('messages.errorOccurred'),
            ]);
        }
    }

    /**
     * Update a single photo in property
     */
    public function updateSinglePhoto(Request $request, $id, $index)
    {
        $property = Property::findOrFail($id);
        
        $request->validate([
            'photo' => 'required|file|mimes:jpg,jpeg,png,webp|max:10240', // 10MB max
        ]);

        // Validate index
        $currentPhotos = $property->photos ?? [];
        if (!is_numeric($index) || $index < 0 || $index >= count($currentPhotos)) {
            return Reply::error(__('messages.invalidPhotoIndex'));
            return back()->with([
                'error' => true,
                'success' => false,
                'message' => __('messages.invalidPhotoIndex'),
            ]);
        }

        try {
            $assetService = app(\App\Services\PropertyAssetService::class);
            $updatedPhotos = $assetService->updateSinglePhoto($property, (int)$index, $request->file('photo'));
            
   
            return back()->with([
                'success' => true,
                'message' => __('messages.photoUpdated'),
                'photos' => $updatedPhotos,
                'property' => $property,
                'redirectUrl' => route('properties.index')
            ]);
        } catch (\Exception $e) {
            return back()->with([
                'success' => false,
                'message' => __('messages.errorOccurred'),
            ]);
        }
    }

    /**
     * Delete a single photo from property
     */
    public function deleteSinglePhoto(Request $request, $id)
    {
        $property = Property::findOrFail($id);
        
        $request->validate([
            'photo_url' => 'required|string',
        ]);

        try {
            $assetService = app(\App\Services\PropertyAssetService::class);
            $success = $assetService->deleteSinglePhoto($property, $request->photo_url);
            
            if ($success) {
                // Reload property to get updated photos
                $property->refresh();
                
                return back()->with([
                    'success' => true,
                    'message' => __('messages.photoDeleted'),
                    'photos' => $property->photos,
                    'property' => $property,
                    'redirectUrl' => route('properties.index')
                ]);
            } else {
                return back()->with([
                    'error' => true,
                    'success' => false,
                    'message' => __('messages.photoNotFound'),
                ]);
            }
        } catch (\Exception $e) {
            \Log::error('Error deleting single photo: ' . $e->getMessage());

            return back()->with([
                'error' => true,
                'success' => false,
                'message' => __('messages.errorOccurred'),
            ]);
            
        }
    }

    /**
     * Handle bulk actions on properties
     */
    public function bulkAction(Request $request)
    {
        $request->validate([
            'property_ids' => 'required|array|min:1',
            'property_ids.*' => 'integer|exists:properties,id',
            'action_type' => 'required|string|in:assign_to_project,change_status,delete',
            'project_id' => 'required_if:action_type,assign_to_project|integer|exists:developer_projects,id',
            'status' => 'required_if:action_type,change_status|string|in:Available,Under offer,Sold,Withdrawn',
        ]);

        $propertyIds = $request->property_ids;
        $actionType = $request->action_type;

        try {
            switch ($actionType) {
                case 'assign_to_project':
                    return $this->assignPropertiesToProject($propertyIds, $request->project_id);
                    
                case 'change_status':
                    return $this->changePropertiesStatus($propertyIds, $request->status);
                    
                case 'delete':
                    return $this->deleteProperties($propertyIds);
                    
                default:
                    if (request()->expectsJson()) {
                        return Reply::error(__('messages.invalidAction'));
                    }
                    return back()->with('error', __('messages.invalidAction'));
            }
        } catch (\Exception $e) {
            \Log::error('Bulk action failed: ' . $e->getMessage());
            
            if (request()->expectsJson()) {
                return Reply::error(__('messages.somethingWentWrong'));
            }
            return back()->with('error', __('messages.somethingWentWrong'));
        }
    }

    /**
     * Assign multiple properties to a developer project
     * 
     * Updated to use DeveloperProject model instead of legacy Project.
     * Properties are now directly assigned via developer_project_id.
     */
    private function assignPropertiesToProject(array $propertyIds, int $projectId)
    {
        $project = \App\Models\DeveloperProject::where('company_id', user()->company_id)
            ->findOrFail($projectId);
        
        // Check for duplicates before assignment
        $duplicateService = app(PropertyDuplicateService::class);
        
        try {
            $duplicateService->assertNoProjectAssignmentConflicts($propertyIds, $projectId, $project->name);
        } catch (DuplicatePropertyException $e) {
            if (request()->expectsJson()) {
                return Reply::error($e->getMessage(), null, 422);
            }
            return back()->withErrors(['duplicate' => $e->getMessage()]);
        }
        
        // Use the model's assignProperties method
        $assignedCount = $project->assignProperties($propertyIds);

        $message = __('messages.propertiesAssignedToProject', [
            'count' => $assignedCount,
            'project' => $project->name
        ]);

        if (request()->expectsJson()) {
            return Reply::success($message);
        }

        return back()->with('success', $message);
    }

    /**
     * Change status of multiple properties
     */
    private function changePropertiesStatus(array $propertyIds, string $status)
    {
        $updatedCount = Property::whereIn('id', $propertyIds)
            ->update(['status' => $status]);

        $message = __('messages.propertiesStatusChanged', [
            'count' => $updatedCount,
            'status' => $status
        ]);

        if (request()->expectsJson()) {
            return Reply::success($message);
        }

        return back()->with('success', $message);
    }

    /**
     * Delete multiple properties
     */
    private function deleteProperties(array $propertyIds)
    {
        // TODO: Refactor to illicit a faster response, the delete should be in bulk on the tables, but photos of all concerned properies be stored temporarily in a buffer variable , and then deleted as a background job, also the concerned products should be deleted in bulk as well
        
        $properties = Property::with('product')->whereIn('id', $propertyIds)->get();
        $deletedCount = 0;

        foreach ($properties as $property) {
            // Delete associated photos
            if ($property->photos) {
                foreach ($property->photos as $photoUrl) {
                    if (strpos($photoUrl, '/storage/') !== false) {
                        $filePath = public_path(str_replace('/storage/', '/storage/app/public/', $photoUrl));
                        if (file_exists($filePath)) {
                            unlink($filePath);
                        }
                    }
                }
            }

            // Delete the property (this will also cascade delete the product if configured)
            $property->delete();
            
            // Delete the associated product if it exists
            if ($property->product) {
                $property->product->delete();
            }
            
            $deletedCount++;
        }

        $message = __('messages.propertiesDeleted', ['count' => $deletedCount]);

        if (request()->expectsJson()) {
            return Reply::success($message);
        }

        return back()->with('success', $message);
    }

    /**
     * Show import form for properties
     */
    public function importProperty()
    {
        $this->addPropertyPermission = user()->permission('add_property');
        abort_403(!in_array($this->addPropertyPermission, ['all', 'added']));

        $this->pageTitle = __('app.importProperties');
        $this->view = 'properties.ajax.import';

        if (request()->ajax()) {
            return $this->returnAjax($this->view);
        }

        return view('properties.import', $this->data);
    }

  

    /**
     * Execute the import process with background jobs
     */
    public function importStore(ImportRequest $request)
    {
        // Handle file upload first
        $file = $request->file('import_file');
        if (!$file) {
            return Reply::error(__('messages.pleaseSelectFile'));
        }

        // Upload the file and get filename
        $fileName = Files::uploadLocalOrS3($file, Files::IMPORT_FOLDER);

        // Create default column mapping (database_field => excel_column_index)
        $defaultColumns = [
            0 => 'title',
            1 => 'property_type',
            2 => 'sale_type',
            3 => 'price',
            4 => 'city',
            5 => 'area',
            6 => 'description',
            7 => 'status',
            8 => 'bedrooms',
            9 => 'bathrooms',
            10 => 'land_size',
            11 => 'building_age',
            12 => 'floor_number',
            13 => 'floors_in_building'
        ];
        
        // Prepare request for importJobProcess
        $request->merge([
            'file' => $fileName,
            'has_heading' => $request->heading == 1,
            'columns' => $request->columns ?? $defaultColumns
        ]);
        
        $this->addPropertyPermission = user()->permission('add_property');
        // abort_403(!in_array($this->addPropertyPermission, ['all', 'added']));

        try {
            $batch = $this->importJobProcess($request, PropertyImport::class, ImportPropertyJob::class);
            
            $this->logUserActivity(user()->id, __('messages.importSuccess'));

            return back()->with([
                'success' => true,
                'message' => __('messages.importStarted'),
                'batch_id' => $batch->id
            ]);
        } catch (\Exception $e) {
            Log::error('Import failed: ' . $e->getMessage());
            return back()->with([
                'error' => true,
                'message' => __('messages.importError')
            ]);
        }
    }

    /**
     * Get sample import template for download
     */
    public function downloadSampleImport()
    {
        $filename = 'property-sample-import.xlsx';
        // $filename = 'property-sample-import.csv';
        $filePath = public_path('sample-import/' . $filename);
        
        if (file_exists($filePath)) {
            return response()->download($filePath, $filename);
        }
        
        return response()->json(['error' => 'Sample file not found'], 404);
    }

    /**
     * Export properties to Excel
     */
    public function exportProperties(Request $request)
    {
        // abort_403(!canDataTableExport());

        // Get filters from request
        $filters = $request->only([
            'property_type',
            'sale_type', 
            'status',
            'city',
            'min_price',
            'max_price',
            'date_from',
            'date_to',
            'search'
        ]);

        $export = new \App\Exports\PropertyExport($filters);
        
        // Generate filename with current date and filters
        $filename = 'properties-export-' . now()->format('Y-m-d-H-i-s') . '.xlsx';
        
        return $this->excel->download($export, $filename);
    }

    public function validateExpose($id)
    {
        $property = Property::with(['product.addedBy'])->findOrFail($id);
        
        // Create default config for validation
        $config = ExposeConfiguration::fromProperty($property, 'vertical_standard');
        
        $warnings = $this->exposeService->checkWarnings($config);
        
        return Reply::successWithData('Expose validation completed successfully!',[
            'data' => ['warnings' => $warnings]
        ]);
    }

    public function generateExpose(Request $request, $id)
    {
        $property = Property::with(['product.addedBy', 'assets'])->findOrFail($id);
        // $layout = $request->input('layout', 'expose-template');
        $layout = 'expose-template';
        
        // Collect client data for personalization
        $clientData = [
            'client_name' => $request->input('client_name'),
            'client_email' => $request->input('client_email'),
        ];
        
        $config = ExposeConfiguration::fromProperty($property, $layout, $clientData);
        
        // Return the download response directly
        return $this->exposeService->generate($config);
    }

    /**
     * Normalize price value to JSON format with amount and currency.
     *
     * @param mixed $priceValue
     * @return string|null
     */
    private function normalizePrice($priceValue): ?string
    {
        if ($priceValue === null || $priceValue === '') {
            return null;
        }

        $defaultCurrency = company()?->currency?->currency_code ?? 'TRY';

        if (is_array($priceValue)) {
            $amount = isset($priceValue['amount']) && $priceValue['amount'] !== null && $priceValue['amount'] !== ''
                ? (float) $priceValue['amount']
                : null;
            $currency = isset($priceValue['currency']) && !empty($priceValue['currency'])
                ? strtoupper($priceValue['currency'])
                : $defaultCurrency;

            return $amount !== null && $amount >= 0
                ? json_encode(['amount' => $amount, 'currency' => $currency])
                : null;
        }

        if (is_string($priceValue)) {
            $trimmed = trim($priceValue);
            $firstChar = $trimmed[0] ?? '';

            if ($firstChar === '{' || $firstChar === '[') {
                $decoded = json_decode($priceValue, true);
                if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
                    $amountValue = $decoded['amount'] ?? null;
                    $amount = ($amountValue !== null && $amountValue !== '' && is_numeric($amountValue))
                        ? (float) $amountValue
                        : null;
                    $currency = isset($decoded['currency']) && !empty($decoded['currency'])
                        ? strtoupper($decoded['currency'])
                        : $defaultCurrency;

                    return $amount !== null && $amount >= 0
                        ? json_encode(['amount' => $amount, 'currency' => $currency])
                        : null;
                }
            }

            $numValue = is_numeric($priceValue) ? (float) $priceValue : null;
            return $numValue !== null && $numValue >= 0
                ? json_encode(['amount' => $numValue, 'currency' => $defaultCurrency])
                : null;
        }

        if (is_numeric($priceValue)) {
            $amount = (float) $priceValue;
            return $amount >= 0
                ? json_encode(['amount' => $amount, 'currency' => $defaultCurrency])
                : null;
        }

        return null;
    }

    // ================================================================
    // Publishing Endpoints
    // ================================================================

    /**
     * Publish a property.
     * Only the creator or admin can publish.
     */
    public function publish($id)
    {
        $property = Property::findOrFail($id);
        
        // Check authorization
        $this->authorize('publish', $property);
        
        if ($property->is_published) {
            return Reply::error('Property is already published');
        }

        $property->publish();
        
        return Reply::successWithData(
            'Property published successfully',
            ['property' => $property->fresh(['addedBy', 'responsibleAgent'])]
        );
    }

    /**
     * Unpublish a property (set to draft).
     * Only the creator or admin can unpublish.
     */
    public function unpublish($id)
    {
        $property = Property::findOrFail($id);
        
        // Check authorization
        $this->authorize('publish', $property);
        
        if (!$property->is_published) {
            return Reply::error('Property is already a draft');
        }

        $property->unpublish();
        
        return Reply::successWithData(
            'Property set to draft successfully',
            ['property' => $property->fresh(['addedBy', 'responsibleAgent'])]
        );
    }

    // ================================================================
    // Access Request Endpoint
    // ================================================================

    /**
     * Request access to a property for selling or viewing.
     * Creates a notification to the responsible agent.
     */
    public function requestAccess(Request $request, $id)
    {
        $property = Property::with(['responsibleAgent', 'addedBy'])->findOrFail($id);
        
        // Check authorization
        $this->authorize('requestAccess', $property);
        
        $validated = $request->validate([
            'message' => 'required|string|max:500',
            'type' => 'required|in:viewing,selling',
        ]);

        $requestingUser = user();
        $responsibleAgent = $property->responsibleAgent ?? $property->addedBy;
        
        if (!$responsibleAgent) {
            return Reply::error('No responsible agent found for this property');
        }

        // Create notification with metadata
        // Using Laravel's notification system with database channel
        $notificationData = [
            'type' => 'property_access_request',
            'property_id' => $property->id,
            'property_reference' => $property->reference_code,
            'property_title' => $property->display_title,
            'requesting_user_id' => $requestingUser->id,
            'requesting_user_name' => $requestingUser->name,
            'request_type' => $validated['type'],
            'message' => $validated['message'],
            'created_at' => now()->toISOString(),
        ];

        // Send notification to responsible agent
        $responsibleAgent->notify(new \App\Notifications\PropertyAccessRequest(
            $property,
            $requestingUser,
            $validated['type'],
            $validated['message']
        ));

        return Reply::success('Access request sent successfully to ' . $responsibleAgent->name);
    }

    // ================================================================
    // Enum Values Endpoint
    // ================================================================

    /**
     * Get all enum values for property dropdowns.
     * Single source of truth for frontend.
     */
    public function getEnumValues()
    {
        return response()->json(Property::getEnumValues());
    }

    // ================================================================
    // Unit Type as Property — Listing, Show, Mark as Sold
    // ================================================================

    /**
     * Build a paginated result of unit types transformed as properties.
     * Used when `source=unit_types`.
     */
    private function getUnitTypeProperties(Request $request, int $perPage)
    {
        $transformer = new UnitTypePropertyTransformer();

        $utQuery = DeveloperProjectUnitType::with(['project.location', 'project.developer', 'assets'])
            ->whereHas('project', function ($q) {
                $q->where('company_id', user()->company_id);
            });

        // Apply compatible filters
        if ($request->filled('property_type') && $request->property_type !== 'all') {
            $utQuery->where('property_type', $request->property_type);
        }
        if ($request->filled('primary_category') && $request->primary_category !== 'all') {
            $utQuery->where('primary_category', $request->primary_category);
        }
        if ($request->filled('search')) {
            $search = $request->search;
            $utQuery->where(function ($q) use ($search) {
                $q->where('reference_code', 'like', "%{$search}%")
                  ->orWhere('description', 'like', "%{$search}%")
                  ->orWhereHas('project', function ($pq) use ($search) {
                      $pq->where('name', 'like', "%{$search}%");
                  });
            });
        }
        if ($request->filled('developer_project_id') && $request->developer_project_id !== 'all') {
            $utQuery->where('developer_project_id', $request->developer_project_id);
        }
        if ($request->filled('min_price')) {
            $utQuery->where('starting_price', '>=', $request->min_price);
        }
        if ($request->filled('max_price')) {
            $utQuery->where('starting_price', '<=', $request->max_price);
        }

        $utQuery->ordered();

        $paginated = $utQuery->paginate($perPage);
        $transformedItems = $transformer->transformMany(collect($paginated->items()));

        return new \Illuminate\Pagination\LengthAwarePaginator(
            $transformedItems->all(),
            $paginated->total(),
            $perPage,
            $paginated->currentPage(),
            ['path' => $request->url(), 'query' => $request->query()]
        );
    }

    /**
     * Show a unit type as a property (read-only view page).
     */
    public function showUnitType($unitTypeId)
    {
        $unitType = DeveloperProjectUnitType::with([
            'assets' => function ($q) {
                $q->orderBy('order')->orderBy('created_at', 'desc');
            },
            'project.location',
            'project.developer',
            'project.assets' => function ($q) {
                $q->orderBy('order')->orderBy('created_at', 'desc');
            },
        ])->whereHas('project', function ($q) {
            $q->where('company_id', user()->company_id);
        })->findOrFail($unitTypeId);

        $project = $unitType->project;

        // Fetch all properties created from this unit type (supports recurring sales)
        $soldProperties = Property::where('developer_project_unit_type_id', $unitType->id)
            ->select('id', 'status', 'created_at')
            ->orderBy('created_at', 'desc')
            ->get();

        // Merge assets: unit type assets + project assets (distinguished by source)
        $mergedAssets = collect();

        // Unit type assets first
        foreach ($unitType->assets ?? [] as $asset) {
            $mergedAssets->push([
                'id' => $asset->id,
                'url' => $asset->url ?? $asset->file_path,
                'name' => $asset->name,
                'asset_type' => $asset->asset_type ?? 'image',
                'tags' => $asset->tags ?? [],
                'source' => 'unit_type',
                'order' => $asset->order ?? 0,
            ]);
        }

        // Project assets next
        foreach ($project->assets ?? [] as $asset) {
            $mergedAssets->push([
                'id' => 'project_' . $asset->id,
                'url' => $asset->url ?? $asset->file_path,
                'name' => $asset->name,
                'asset_type' => $asset->asset_type ?? 'image',
                'tags' => array_merge($asset->tags ?? [], ['Project']),
                'source' => 'project',
                'order' => $asset->order ?? 0,
            ]);
        }

        // Get deals for the "Mark as Sold" modal
        $deals = Deal::where('company_id', user()->company_id)
            ->select('id', 'name', 'lead_id')
            ->with('contact:id,client_name,client_email')
            ->orderBy('name')
            ->limit(200)
            ->get()
            ->map(function ($deal) {
                return [
                    'id' => $deal->id,
                    'name' => $deal->name,
                    'contact_name' => $deal->contact?->client_name ?? '',
                ];
            });

        $employees = User::allEmployees();

        return Inertia::render('Properties/UnitTypeShow', [
            'pageTitle' => $unitType->display_label . ' — ' . ($project->name ?? 'Unit Type'),
            'unitType' => $unitType,
            'developerProject' => $project->load(['location', 'developer']),
            'mergedAssets' => $mergedAssets->values(),
            'soldCount' => $soldProperties->count(),
            'soldPropertyIds' => $soldProperties->pluck('id')->values()->all(),
            'deals' => $deals,
            'employees' => $employees,
        ]);
    }

    /**
     * Mark a unit type as sold — creates a real Property + Product from the unit type data.
     */
    public function markUnitTypeAsSold(Request $request, $unitTypeId)
    {
        $unitType = DeveloperProjectUnitType::with(['project.location', 'project.developer'])
            ->whereHas('project', function ($q) {
                $q->where('company_id', user()->company_id);
            })
            ->findOrFail($unitTypeId);

        $request->validate([
            'deal_id' => 'nullable|integer|exists:leads,id',
            'responsible_agent_id' => 'nullable|integer|exists:users,id',
        ]);

        $project = $unitType->project;
        $location = $project?->location;

        // Build a descriptive name
        $productName = ($project?->name ?? '') . ' — ' . ($unitType->display_label ?? 'Unit Type');
        $productPrice = $unitType->starting_price ? (float) $unitType->starting_price : 0;

        DB::beginTransaction();
        try {
            // 1. Create Product
            $product = Product::create([
                'name' => $productName,
                'price' => $productPrice,
                'description' => $unitType->description ?? '',
                'allow_purchase' => 0,
                'company_id' => user()->company_id,
                'added_by' => user()->id,
                'unit_id' => 1,
            ]);

            // 2. Create Property
            $property = new Property();
            $property->company_id = user()->company_id;
            $property->added_by = user()->id;
            $property->product_id = $product->id;
            $property->developer_project_id = $unitType->developer_project_id;
            $property->developer_project_unit_type_id = $unitType->id;
            $property->project_location_id = $project?->project_location_id;

            // Type info from unit type
            $property->primary_category = $unitType->primary_category;
            $property->property_type = $unitType->property_type;
            $property->unit_style = $unitType->unit_style;
            $property->sale_type = 'sale';
            $property->construction_status = $project?->construction_status;
            $property->furniture_status = $unitType->furniture_status;
            $property->view_types = $unitType->view_types;

            // Price
            $property->price = json_encode([
                'amount' => $productPrice,
                'currency' => $unitType->currency ?? 'GBP',
            ]);

            // Location from project
            $property->city = $location?->address['city'] ?? $location?->name ?? '';
            $property->area = $location?->address['state'] ?? '';

            // Specs
            $property->bedrooms = $unitType->bedrooms;
            $property->bathrooms = $unitType->bathrooms;
            $property->floor_number = is_numeric($unitType->floor) ? (int) $unitType->floor : null;
            $property->floor = $unitType->floor;
            $property->floors_in_building = $unitType->floors_in_building;
            $property->total_area_sqm = $unitType->total_area_sqm;
            $property->living_area_sqm = $unitType->living_area_sqm;
            $property->terrace_area_sqm = $unitType->terrace_balcony_sqm;
            $property->plot_size_sqm = $unitType->plot_size_sqm;
            $property->completion_date = $unitType->completion_date;

            // Features
            $property->exterior_features = $unitType->outside_features ?? [];
            $property->interior_features = $unitType->inside_features ?? [];

            // Content
            $property->title = $productName;
            $property->description = $unitType->description;

            // Legal
            $property->has_restrictions = $unitType->has_restrictions;
            $property->restriction_notes = $unitType->restriction_notes;

            // Status
            $property->status = Property::STATUS_SOLD ?? 'Sold';
            $property->is_published = true;
            $property->within_site = true;

            // Agent
            if ($request->filled('responsible_agent_id')) {
                $property->responsible_agent_id = $request->responsible_agent_id;
            }

            $property->save();

            // 3. Link to Deal if provided
            if ($request->filled('deal_id')) {
                DB::table('lead_products')->insert([
                    'deal_id' => $request->deal_id,
                    'product_id' => $product->id,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            DB::commit();

            return Reply::successWithData('Unit type marked as sold. Property created successfully.', [
                'property_id' => $property->id,
                'redirectUrl' => route('properties.show', $property->id),
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Mark unit type as sold failed', [
                'unit_type_id' => $unitTypeId,
                'error' => $e->getMessage(),
            ]);
            return Reply::error('Failed to mark unit type as sold: ' . $e->getMessage());
        }
    }
}