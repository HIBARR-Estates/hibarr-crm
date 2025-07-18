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
     * Display a listing of the resource.
     */
    public function index()
    {
        $categories = CustomFieldCategory::all();
        return view('custom-field-categories.index', compact('categories'));
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {
        return view('custom-field-categories.create');
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(StoreCustomFieldCategoryRequest $request)
    {
        CustomFieldCategory::create($request->validated());
        return redirect()->route('custom-field-categories.index')->with('success', 'Category created successfully.');
    }

    /**
     * Display the specified resource.
     */
    public function show($id)
    {
        $category = CustomFieldCategory::findOrFail($id);
        return view('custom-field-categories.show', compact('category'));
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit($id)
    {
        $category = CustomFieldCategory::findOrFail($id);
        return view('custom-field-categories.edit', compact('category'));
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(UpdateCustomFieldCategoryRequest $request, $id)
    {
        $category = CustomFieldCategory::findOrFail($id);
        $category->update($request->validated());
        return redirect()->route('custom-field-categories.index')->with('success', 'Category updated successfully.');
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy($id)
    {
        $category = CustomFieldCategory::findOrFail($id);
        $category->delete();
        return redirect()->route('custom-field-categories.index')->with('success', 'Category deleted successfully.');
    }
}