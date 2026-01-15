<?php

namespace App\Http\Controllers;

use App\Helper\Reply;
use App\Models\CustomFieldCategory;
use App\Models\CustomFieldGroup;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CustomFieldCategoryController extends AccountBaseController
{
    public function __construct()
    {
        parent::__construct();
        $this->pageTitle = 'Custom Field Categories';
        $this->activeSettingMenu = 'custom_field_categories';
        $this->middleware(function ($request, $next) {
            abort_403(user()->permission('manage_custom_field_setting') !== 'all');
            return $next($request);
        });
    }

    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        $this->categories = CustomFieldCategory::with('customFieldGroup')
            ->where('company_id', company()->id)
            ->orderBy(DB::raw('`order`'), 'asc')
            ->orderBy('id', 'asc')
            ->get();
        $this->customFieldGroups = CustomFieldGroup::all();

        return view('custom-fields.categories-index', $this->data);
    }

    /**
     * Get categories for a specific custom field group
     */
    public function getCategoriesByGroup(Request $request)
    {
        $groupId = $request->get('custom_field_group_id');

        if (!$groupId) {
            return Reply::error('Custom field group ID is required');
        }

        $categories = CustomFieldCategory::where('custom_field_group_id', $groupId)
            ->where('company_id', company()->id)
            ->orderBy(DB::raw('`order`'), 'asc')
            ->orderBy('id', 'asc')
            ->get(['id', 'name']);

        return Reply::dataOnly(['categories' => $categories]);
    }

    /**
     * Store a new category
     */
    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'custom_field_group_id' => 'required|exists:custom_field_groups,id',
            'order' => 'nullable|integer|min:0'
        ]);

        // If order is not provided, set it to the next available order (max + 1)
        $order = $request->order;
        if ($order === null || $order === '') {
            $maxOrder = CustomFieldCategory::where('company_id', company()->id)
                ->where('custom_field_group_id', $request->custom_field_group_id)
                ->max(DB::raw('`order`'));
            $order = ($maxOrder !== null) ? $maxOrder + 1 : 0;
        }

        $category = CustomFieldCategory::create([
            'name' => $request->name,
            'custom_field_group_id' => $request->custom_field_group_id,
            'company_id' => company()->id,
            'order' => $order
        ]);

        return Reply::successWithData('Category created successfully', ['category' => $category]);
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit($id)
    {
        $this->category = CustomFieldCategory::where('company_id', company()->id)->findOrFail($id);
        $this->customFieldGroups = CustomFieldGroup::all();
        $this->pageTitle = __('modules.customFields.editCategory');

        if (request()->ajax()) {
            return $this->returnAjax('custom-fields.ajax.edit-category');
        }

        return view('custom-fields.edit-category', $this->data);
    }

    /**
     * Update a category
     */
    public function update(Request $request, $id)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'custom_field_group_id' => 'required|exists:custom_field_groups,id',
            'order' => 'nullable|integer|min:0'
        ]);

        $category = CustomFieldCategory::where('company_id', company()->id)->findOrFail($id);
        $category->update([
            'name' => $request->name,
            'custom_field_group_id' => $request->custom_field_group_id,
            'order' => $request->order ?? 0
        ]);

        return Reply::success('Category updated successfully');
    }

    /**
     * Delete a category
     */
    public function destroy($id)
    {
        $category = CustomFieldCategory::where('company_id', company()->id)->findOrFail($id);

        // Check if category has custom fields
        if ($category->customFields()->count() > 0) {
            return Reply::error('Cannot delete category that has custom fields. Please reassign or delete the custom fields first.');
        }

        $category->delete();
        return Reply::success('Category deleted successfully');
    }

    /**
     * Sort categories order
     *
     * @param Request $request
     * @return \Illuminate\Http\Response
     */
    public function sortCategories(Request $request)
    {
        $sortedIds = $request->sortedIds;

        if (!is_array($sortedIds)) {
            return Reply::error('Invalid sorted IDs');
        }

        foreach ($sortedIds as $index => $categoryId) {
            CustomFieldCategory::where('id', $categoryId)
                ->where('company_id', company()->id)
                ->update(['order' => $index + 1]);
        }

        return Reply::success('Category order updated successfully');
    }
}
