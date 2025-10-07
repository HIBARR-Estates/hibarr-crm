<?php

namespace App\Http\Controllers;

use App\Models\Property;
use App\Models\Product;
use App\Http\Requests\Property\StoreRequest;
use App\Http\Requests\Property\UpdateRequest;
use App\Helper\Reply;
use Illuminate\Http\Request;

class PropertyController extends AccountBaseController
{
    private $addPropertyPermission;
    private $viewPropertyPermission;
    private $editPropertyPermission;
    private $deletePropertyPermission;

    public function __construct()
    {
        parent::__construct();
        
        $this->addPropertyPermission = user()->permission('add_properties');
        $this->viewPropertyPermission = user()->permission('view_properties');
        $this->editPropertyPermission = user()->permission('edit_properties');
        $this->deletePropertyPermission = user()->permission('delete_properties');

        $this->middleware(function ($request, $next) {
            abort_403(!in_array($this->viewPropertyPermission, ['all', 'added', 'owned', 'both']));
            return $next($request);
        });
    }

    public function index(Request $request)
    {
        abort_403(!in_array($this->viewPropertyPermission, ['all', 'added', 'owned', 'both']));

        // Get properties with pagination and filtering
        $query = Property::with('product');

        // Apply permission-based filtering
        switch ($this->viewPropertyPermission) {
            case 'added':
                $query->whereHas('product', function($q) {
                    $q->where('added_by', user()->id);
                });
                break;
            case 'owned':
                $query->whereHas('product', function($q) {
                    $q->where('assigned_to', user()->id);
                });
                break;
            case 'both':
                $query->whereHas('product', function($q) {
                    $q->where(function($subQ) {
                        $subQ->where('added_by', user()->id)
                             ->orWhere('assigned_to', user()->id);
                    });
                });
                break;
        }

        // Apply filters if provided
        if ($request->has('property_type') && $request->property_type !== '') {
            $query->where('property_type', $request->property_type);
        }

        if ($request->has('sale_type') && $request->sale_type !== '') {
            $query->where('sale_type', $request->sale_type);
        }

        if ($request->has('status') && $request->status !== '') {
            $query->where('status', $request->status);
        }

        if ($request->has('city') && $request->city !== '') {
            $query->where('city', 'like', '%' . $request->city . '%');
        }

        if ($request->has('min_price') && $request->min_price !== '') {
            $query->where('price', '>=', $request->min_price);
        }

        if ($request->has('max_price') && $request->max_price !== '') {
            $query->where('price', '<=', $request->max_price);
        }

        // Apply search if provided
        if ($request->has('search') && $request->search !== '') {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->where('title', 'like', '%' . $search . '%')
                  ->orWhere('description', 'like', '%' . $search . '%')
                  ->orWhere('area', 'like', '%' . $search . '%');
            });
        }

        // Order by creation date (newest first)
        $query->orderBy('created_at', 'desc');

        $properties = $query->paginate(15);

        // Get products for property assignment
        $this->products = Product::where('status', 'active')->get();
        $this->properties = $properties;
        
        return view('properties.index', $this->data);
    }

    public function create()
    {
        abort_403(!in_array($this->addPropertyPermission, ['all', 'added']));

        $this->pageTitle = __('app.add') . ' ' . __('app.property');
        
        // Get products that don't have properties yet
        $this->products = Product::whereDoesntHave('property')
            ->where('status', 'active')
            ->get();

        if (request()->ajax()) {
            return view('properties.ajax.create', $this->data);
        }

        return view('properties.create', $this->data);
    }

    public function store(StoreRequest $request)
    {
        abort_403(!in_array($this->addPropertyPermission, ['all', 'added']));

        $property = new Property();
        $property->product_id = $request->product_id;
        $property->property_type = $request->property_type;
        $property->sale_type = $request->sale_type;
        $property->price = $request->price;
        $property->dues = $request->dues;
        $property->minimal_rental_period = $request->minimal_rental_period;
        $property->rent_payment_interval = $request->rent_payment_interval;
        $property->title_deed = $request->title_deed;
        $property->open_to_trade = $request->has('open_to_trade');
        $property->status = $request->status ?? Property::STATUS_AVAILABLE;
        $property->city = $request->city;
        $property->area = $request->area;
        $property->rooms = $request->rooms;
        $property->bedrooms = $request->bedrooms;
        $property->bathrooms = $request->bathrooms;
        $property->floor_number = $request->floor_number;
        $property->floors_in_building = $request->floors_in_building;
        $property->building_age = $request->building_age;
        $property->is_furnished = $request->has('is_furnished');
        $property->within_site = $request->has('within_site');
        $property->exterior_features = $request->exterior_features ? json_decode($request->exterior_features, true) : null;
        $property->interior_features = $request->interior_features ? json_decode($request->interior_features, true) : null;
        $property->location_features = $request->location_features ? json_decode($request->location_features, true) : null;
        $property->title = $request->title;
        $property->description = $request->description;
        $property->video_url = $request->video_url;
        $property->tour_360_url = $request->tour_360_url;
        
        $property->save();

        return Reply::successWithData(__('messages.recordSaved'), ['property' => $property, 'redirectUrl' => route('properties.index')]);
    }

    public function show($id)
    {
        $this->property = Property::with('product')->findOrFail($id);
        
        // Check permission
        $canView = false;
        switch ($this->viewPropertyPermission) {
            case 'all':
                $canView = true;
                break;
            case 'added':
                $canView = $this->property->product->added_by == user()->id;
                break;
            case 'owned':
                $canView = $this->property->product->assigned_to == user()->id;
                break;
            case 'both':
                $canView = $this->property->product->added_by == user()->id || $this->property->product->assigned_to == user()->id;
                break;
        }

        abort_403(!$canView);

        $this->pageTitle = $this->property->title;

        if (request()->ajax()) {
            return view('properties.ajax.show', $this->data);
        }

        return view('properties.show', $this->data);
    }

    public function edit($id)
    {
        $this->property = Property::with('product')->findOrFail($id);
        
        // Check permission
        $canEdit = false;
        switch ($this->editPropertyPermission) {
            case 'all':
                $canEdit = true;
                break;
            case 'added':
                $canEdit = $this->property->product->added_by == user()->id;
                break;
            case 'owned':
                $canEdit = $this->property->product->assigned_to == user()->id;
                break;
            case 'both':
                $canEdit = $this->property->product->added_by == user()->id || $this->property->product->assigned_to == user()->id;
                break;
        }

        abort_403(!$canEdit);

        $this->pageTitle = __('app.edit') . ' ' . __('app.property');
        
        // Get products for property assignment
        $this->products = Product::where('status', 'active')->get();

        if (request()->ajax()) {
            return view('properties.ajax.edit', $this->data);
        }

        return view('properties.edit', $this->data);
    }

    public function update(UpdateRequest $request, $id)
    {
        $property = Property::with('product')->findOrFail($id);
        
        // Check permission
        $canEdit = false;
        switch ($this->editPropertyPermission) {
            case 'all':
                $canEdit = true;
                break;
            case 'added':
                $canEdit = $property->product->added_by == user()->id;
                break;
            case 'owned':
                $canEdit = $property->product->assigned_to == user()->id;
                break;
            case 'both':
                $canEdit = $property->product->added_by == user()->id || $property->product->assigned_to == user()->id;
                break;
        }

        abort_403(!$canEdit);

        // Check if updates are allowed based on current status
        $fieldsToUpdate = $request->only($property->getFillable());
        foreach ($fieldsToUpdate as $field => $value) {
            abort_403(!$property->canUpdateField($field), __('messages.propertyUpdateNotAllowed', ['field' => $field]));
        }

        $property->update($fieldsToUpdate);

        return Reply::successWithData(__('messages.recordUpdated'), ['property' => $property, 'redirectUrl' => route('properties.index')]);
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

        abort_403(!$canDelete);

        // Don't allow deletion if property is sold or rented
        if ($property->isSold() || $property->isRented()) {
            return Reply::error(__('messages.propertyCannotBeDeleted'));
        }

        $property->delete();

        return Reply::successWithData(__('messages.recordDeleted'));
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
            return Reply::successWithData(__('messages.deleteSuccess'), ['reload' => true]);
        }

        if ($action == 'change-status') {
            $this->changeStatus($checkedIds, $request->status);
            return Reply::successWithData(__('messages.statusUpdated'), ['reload' => true]);
        }

        return Reply::error(__('messages.selectAction'));
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
}