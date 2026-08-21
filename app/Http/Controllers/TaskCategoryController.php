<?php

namespace App\Http\Controllers;

use App\Helper\Reply;
use App\Http\Requests\Tasks\StoreTaskCategory;
use App\Models\BaseModel;
use App\Models\TaskCategory;

class TaskCategoryController extends AccountBaseController
{

    public function index()
    {
        $this->authorizeManageCategories();

        $categories = TaskCategory::orderBy('category_name')->get();
        return Reply::dataOnly(['categories' => $categories]);
    }

    public function create()
    {
        $this->addPermission = user()->permission('add_task_category');
        abort_403(!in_array($this->addPermission, ['all', 'added']));

        $this->categories = TaskCategory::allCategories();
        return view('tasks.create_category', $this->data);
    }

    public function store(StoreTaskCategory $request)
    {
        $this->authorizeManageCategories(requireWrite: true);

        $category = new TaskCategory();
        $category->category_name = $request->category_name;
        $category->save();

        $categories = TaskCategory::allCategories();
        $options = BaseModel::options($categories, $category, 'category_name');

        return Reply::successWithData(__('messages.recordSaved'), ['data' => $options]);

    }

    public function update(StoreTaskCategory $request, $id)
    {
        $this->authorizeManageCategories(requireWrite: true);

        $category = TaskCategory::findOrFail($id);
        $category->category_name = strip_tags($request->category_name);
        $category->save();

        $categories = TaskCategory::allCategories();
        $options = BaseModel::options($categories, null, 'category_name');

        return Reply::successWithData(__('messages.updateSuccess'), ['data' => $options]);
    }

    public function destroy($id)
    {
        $this->authorizeManageCategories(requireWrite: true);

        TaskCategory::destroy($id);
        $categories = TaskCategory::allCategories();
        $options = BaseModel::options($categories, null, 'category_name');

        return Reply::successWithData(__('messages.deleteSuccess'), ['data' => $options]);
    }

    /** Admin or view_task_category=all may open the manager; writes need add_task_category. */
    private function authorizeManageCategories(bool $requireWrite = false): void
    {
        $isAdmin = in_array('admin', user_roles(), true);
        $canView = user()->permission('view_task_category') === 'all';

        abort_403(! ($isAdmin || $canView));

        if ($requireWrite) {
            abort_403(! in_array(user()->permission('add_task_category'), ['all', 'added'], true));
        }
    }

}
