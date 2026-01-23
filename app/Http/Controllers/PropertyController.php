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
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Session;
use Maatwebsite\Excel\Excel;
use Inertia\Inertia;
use Illuminate\Support\Facades\Log;
use App\Helper\Files;
use App\Services\PdfExpose\ExposeGeneratorService;
use App\Services\PdfExpose\Configuration\ExposeConfiguration;


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
        
        
    }

    public function index(Request $request)
    {
        // Get properties with pagination and filtering
        $query = Property::with('product');

        
        // Apply filters if provided
        if ($request->filled('property_type') && $request->property_type !== 'all') {
            $query->where('property_type', $request->property_type);
        }

        if ($request->filled('sale_type') && $request->sale_type !== 'all') {
            $query->where('sale_type', $request->sale_type);
        }

        if ($request->filled('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        }

        if ($request->filled('city')) {
            $query->where('city', 'like', '%' . $request->city . '%');
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

        $properties = $query->paginate(15);

        // Get products for property assignment in create drawer
        $products = Product::whereDoesntHave('property')->get();

        // Get products for property assignment
        // $this->products = Product::where('status', 'active')->get();
        // return Inertia::render('Home', [
        //     'greeting' => 'Welcome to Inertia.js with Laravel',
        // ]);
        $this->properties = $properties;
        

        // Get developer projects for assignment
        $developerProjects = \App\Models\DeveloperProject::select('id', 'name', 'project_location_id')
            ->with('location:id,name')
            ->where('company_id', user()->company_id)
            ->get();
            
        // Legacy: Get users with employee role for developer selection (pinned for future)
        $developers = \App\Models\User::whereHas('roles', function($query) {
                $query->where('name', 'employee');
            })
            ->select('id', 'name', 'email')
            ->get();
        
        return Inertia::render('Properties/Index', [
            'pageTitle' => 'Properties',
            'properties' => $this->properties,
            'products' => $products,
            'developerProjects' => $developerProjects,
            'developers' => $developers,
            'filters' => $request->only(['search', 'property_type', 'sale_type', 'status', 'city', 'min_price', 'max_price'])
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

        // create the product first, and then attach the product_id to property
        $product = Product::create([
                    'name' => $request->title,
                    'price' => $request->price ?? 0,
                    'description' => $request->description ?? '',
                    'allow_purchase' => $request->status == Property::STATUS_AVAILABLE ? 1 : 0, //TODO: Reach out to Team lead to confirm business specifications
                    'company_id' => user()->company_id,
                    'added_by' => user()->id,
                    'unit_id' => 1, // TODO: Get the property unit_id (i.e unit_type) to be assocuated with property
        ]);

        // TODO: Create a property observer, so once the the product is updated, the product has the necessary fields updated

        $property = new Property();
        $property->company_id = user()->company_id;
        $property->product_id = $product->id;
        $property->property_type = $request->property_type;
        $property->sale_type = $request->sale_type;
        $property->price = $request->price;
        $property->minimal_rental_period = $request->minimal_rental_period;
        $property->rent_payment_interval = $request->rent_payment_interval;
        $property->title_deed_type = $request->title_deed_type;
        $property->title_deed_stage = $request->title_deed_stage;
        $property->status = $request->status ?? Property::STATUS_AVAILABLE;
        $property->city = $request->city;
        $property->map = $request->map;
        $property->area = $request->area;
        $property->land_size = $request->land_size;
        $property->living_room = $request->living_room;
        $property->bedrooms = $request->bedrooms;
        $property->bathrooms = $request->bathrooms;
        $property->floor_number = $request->floor_number;
        $property->floors_in_building = $request->floors_in_building;
        $property->building_age = $request->building_age;
        $property->furniture_status = $request->furniture_status;
        $property->within_site = $request->has('within_site') || $request->within_site;
        $property->exterior_features = $request->exterior_features ? (is_array($request->exterior_features) ? $request->exterior_features : json_decode($request->exterior_features, true)) : [];
        $property->interior_features = $request->interior_features ? (is_array($request->interior_features) ? $request->interior_features : json_decode($request->interior_features, true)) : [];
        $property->location_features = $request->location_features ? (is_array($request->location_features) ? $request->location_features : json_decode($request->location_features, true)) : [];
        $property->title = $request->title;
        $property->description = $request->description;
        $property->video_url = $request->video_url;
        $property->tour_360_url = $request->tour_360_url;
        $property->photos = $request->photos ? (is_array($request->photos) ? $request->photos : json_decode($request->photos, true)) : [];
        $property->add_ons = $request->add_ons ? (is_array($request->add_ons) ? $request->add_ons : json_decode($request->add_ons, true)) : [];
        
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
        $this->property = Property::with(['product', 'assets' => function($query) {
            $query->orderBy('order')->orderBy('created_at', 'desc');
        }])->findOrFail($id);
        
        // // Check permission
        // $canView = false;
        // switch ($this->viewPropertyPermission) {
        //     case 'all':
        //         $canView = true;
        //         break;
        //     case 'added':
        //         $canView = $this->property->product->added_by == user()->id;
        //         break;
        //     case 'owned':
        //         $canView = $this->property->product->assigned_to == user()->id;
        //         break;
        //     case 'both':
        //         $canView = $this->property->product->added_by == user()->id || $this->property->product->assigned_to == user()->id;
        //         break;
        // }

        // abort_403(!$canView);

        // $this->pageTitle = $this->property->title;

        // // Check if user can edit this property
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
        $this->pageTitle = $this->property->title;

        // Get tasks
        $tasks = $this->property->tasks()
            ->with(['users', 'category', 'boardColumn', 'labels'])
            ->orderBy('id', 'desc')
            ->get();

        // Get task metadata for modal
        $taskCategories = \App\Models\TaskCategory::all();
        $taskLabels = \App\Models\TaskLabelList::all();
        $taskBoardColumns = \App\Models\TaskboardColumn::orderBy('priority')->get();
        $employees = User::allEmployees();
        $projects = \App\Models\Project::all();

        // Get task permissions
        $taskPermissions = [
            'add_tasks' => user()->permission('add_tasks'),
            'edit_tasks' => user()->permission('edit_tasks'),
            'delete_tasks' => user()->permission('delete_tasks'),
            'view_tasks' => user()->permission('view_tasks'),
        ];

        if (request()->ajax()) {
            return Inertia::render('Properties/Show', [
                'pageTitle' => $this->pageTitle,
                'property' => $this->property,
                'canEdit' => $canEdit,
                'tasks' => $tasks,
                'taskCategories' => $taskCategories,
                'taskLabels' => $taskLabels,
                'taskBoardColumns' => $taskBoardColumns,
                'employees' => $employees,
                'projects' => $projects,
                'taskPermissions' => $taskPermissions,
            ]);
        }

        return Inertia::render('Properties/Show', [
            'pageTitle' => $this->pageTitle,
            'property' => $this->property,
            'canEdit' => $canEdit,
            'tasks' => $tasks,
            'taskCategories' => $taskCategories,
            'taskLabels' => $taskLabels,
            'taskBoardColumns' => $taskBoardColumns,
            'employees' => $employees,
            'projects' => $projects,
            'taskPermissions' => $taskPermissions,
        ]);
    }

    public function edit($id)
    {
        $this->property = Property::with('product')->findOrFail($id);
        
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

        // Check if updates are allowed based on current status
        $fieldsToUpdate = $request->only($property->getFillable());
        foreach ($fieldsToUpdate as $field => $value) {
            abort_403(!$property->canUpdateField($field), __('messages.propertyUpdateNotAllowed', ['field' => $field]));
        }

        $property->update($fieldsToUpdate);

        

        return back()->with([
            'success' => true,
            'message' => __('messages.recordUpdated'),
            'property' => $property,
            'redirectUrl' => route('properties.index')
        ]);
    }

    public function destroy($id)
    {
        $property = Property::with('product')->findOrFail($id);
        
        // Check permission
        $canDelete = false;
        switch ($this->deletePropertyPermission) {
            case 'all':
                $canDelete = true;
                break;
            case 'added':
                $canDelete = $property->product->added_by == user()->id;
                break;
            case 'owned':
                $canDelete = $property->product->assigned_to == user()->id;
                break;
            case 'both':
                $canDelete = $property->product->added_by == user()->id || $property->product->assigned_to == user()->id;
                break;
        }

        // abort_403(!$canDelete); //Removed permission check for deletion temporarily, as per request on 22-01-2026

        // TODO: COnsider implementing reintroducing permission check above via Permission service, and ensure its applicable to the bulk action as well, also just refactor permissions to be a permission middleware thing and free all controllers ....


        // TODO: Refactor to use service and let the response be strictly JSON for consistency
        // Don't allow deletion if property is sold or rented
        if ($property->isSold() || $property->isRented()) {
            return back()->with([
                'success' => false,
                'message' => __('messages.propertyCannotBeDeleted'),
            ]);
        }

        $property->delete();

        return back()->with([
            'success' => true,
            'message' => __('messages.recordDeleted'),
        ]);
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
        $property = Property::with(['product.addedBy'])->findOrFail($id);
        $layout = $request->input('layout', 'vertical_standard');
        
        $config = ExposeConfiguration::fromProperty($property, $layout);
        
        // Return the download response directly
        return $this->exposeService->generate($config);
    }
}