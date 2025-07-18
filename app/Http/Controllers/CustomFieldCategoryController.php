<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\CustomFieldCategory;
use App\Http\Requests\CustomFieldCategory\StoreCustomFieldCategoryRequest;
use App\Http\Requests\CustomFieldCategory\UpdateCustomFieldCategoryRequest;

class CustomFieldCategoryController extends Controller
{
    /**
     * Displays a list of all custom field categories.
     *
     * Retrieves all custom field categories and returns a view to display them.
     */
    public function index()
    {
        $categories = CustomFieldCategory::all();
        return view('custom-field-categories.index', compact('categories'));
    }

    /**
     * Displays the form for creating a new custom field category.
     *
     * @return \Illuminate\View\View
     */
    public function create()
    {
        return view('custom-field-categories.create');
    }

    /**
     * Creates a new custom field category using validated request data and redirects to the category index with a success message.
     *
     * @param StoreCustomFieldCategoryRequest $request The validated request containing category data.
     * @return \Illuminate\Http\RedirectResponse
     */
    public function store(StoreCustomFieldCategoryRequest $request)
    {
        CustomFieldCategory::create($request->validated());
        return redirect()->route('custom-field-categories.index')->with('success', 'Category created successfully.');
    }

    /**
     * Displays the details of a specific custom field category.
     *
     * @param int $id The ID of the custom field category to display.
     * @return \Illuminate\View\View
     */
    public function show($id)
    {
        $category = CustomFieldCategory::findOrFail($id);
        return view('custom-field-categories.show', compact('category'));
    }

    /**
     * Displays the form to edit an existing custom field category.
     *
     * @param int $id The ID of the custom field category to edit.
     * @return \Illuminate\View\View The view with the edit form and category data.
     */
    public function edit($id)
    {
        $category = CustomFieldCategory::findOrFail($id);
        return view('custom-field-categories.edit', compact('category'));
    }

    /**
     * Updates an existing custom field category with validated data.
     *
     * @param UpdateCustomFieldCategoryRequest $request The validated request data for updating the category.
     * @param int $id The ID of the custom field category to update.
     * @return \Illuminate\Http\RedirectResponse Redirects to the category index with a success message.
     */
    public function update(UpdateCustomFieldCategoryRequest $request, $id)
    {
        $category = CustomFieldCategory::findOrFail($id);
        $category->update($request->validated());
        return redirect()->route('custom-field-categories.index')->with('success', 'Category updated successfully.');
    }

    /**
     * Deletes a custom field category by its ID and redirects to the category index with a success message.
     *
     * @param int $id The ID of the custom field category to delete.
     * @return \Illuminate\Http\RedirectResponse
     */
    public function destroy($id)
    {
        $category = CustomFieldCategory::findOrFail($id);
        $category->delete();
        return redirect()->route('custom-field-categories.index')->with('success', 'Category deleted successfully.');
    }
}