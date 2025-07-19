<?php

namespace App\Http\Controllers;

use App\Helper\Reply;
use App\Models\CustomFieldCategory;
use App\Models\CustomFieldGroup;
use Illuminate\Http\Request;

class CustomFieldCategoryController extends AccountBaseController
{
    public function __construct()
    {
        parent::__construct();
        $this->pageTitle = 'Custom Field Categories';
        $this->activeSettingMenu = 'custom_fields';
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
            ->get();
        $this->customFieldGroups = CustomFieldGroup::all();

        return view('custom-fields.categories', $this->data);
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
            'custom_field_group_id' => 'required|exists:custom_field_groups,id'
        ]);

        $category = CustomFieldCategory::create([
            'name' => $request->name,
            'custom_field_group_id' => $request->custom_field_group_id,
            'company_id' => company()->id
        ]);

        return Reply::successWithData('Category created successfully', ['category' => $category]);
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit($id)
    {
        $category = CustomFieldCategory::where('company_id', company()->id)->findOrFail($id);
        return Reply::dataOnly(['category' => $category]);
    }

    /**
     * Update a category
     */
    public function update(Request $request, $id)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'custom_field_group_id' => 'required|exists:custom_field_groups,id'
        ]);

        $category = CustomFieldCategory::where('company_id', company()->id)->findOrFail($id);
        $category->update([
            'name' => $request->name,
            'custom_field_group_id' => $request->custom_field_group_id
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
}
