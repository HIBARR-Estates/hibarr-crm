<?php

namespace App\Http\Controllers;

use App\Models\Developer;
use App\DataTables\DevelopersDataTable;
use App\Http\Requests\Developer\StoreRequest;
use App\Http\Requests\Developer\UpdateRequest;
use App\Helper\Reply;
use Illuminate\Http\Request;

class DeveloperController extends AccountBaseController
{
    private $addDeveloperPermission;
    private $viewDeveloperPermission;
    private $editDeveloperPermission;
    private $deleteDeveloperPermission;

    public function __construct()
    {
        parent::__construct();
        $this->pageTitle = 'app.menu.developers';
        
        // Check if user has access to developers module
        $this->middleware(function ($request, $next) {
            abort_403(!in_array('developers', $this->user->modules));
            
            // Set permissions
            $this->addDeveloperPermission = user()->permission('add_developers');
            $this->viewDeveloperPermission = user()->permission('view_developers');
            $this->editDeveloperPermission = user()->permission('edit_developers');
            $this->deleteDeveloperPermission = user()->permission('delete_developers');
            
            return $next($request);
        });
    }

    public function index(DevelopersDataTable $dataTable)
    {
        // Sales Agents → Read only (permission level 2 = 'owned' or 5 = 'none')
        // Sales Manager → Full CRUD (permission level 4 = 'all')
        // Media Team → CRU (permission level 1,2,3 = 'added', 'owned', 'both')
        // Media Team Lead → Full CRUD (permission level 4 = 'all')
        
        abort_403(!in_array($this->viewDeveloperPermission, ['all', 'added', 'owned', 'both']));

        return $dataTable->render('developers.index', $this->data);
    }

    public function create()
    {
        // Only allow creation for roles with add permission
        abort_403(!in_array($this->addDeveloperPermission, ['all', 'added']));

        $this->pageTitle = __('app.add') . ' ' . __('app.developer');
        
        if (request()->ajax()) {
            return view('developers.ajax.create', $this->data);
        }

        return view('developers.create', $this->data);
    }

    public function store(StoreRequest $request)
    {
        abort_403(!in_array($this->addDeveloperPermission, ['all', 'added']));

        $developer = new Developer();
        $developer->company_id = company()->id;
        $developer->name = $request->name;
        $developer->description = $request->description;
        
        if ($request->hasFile('logo')) {
            $developer->logo = $this->uploadFile($request->logo, 'developers');
        }
        
        $developer->added_by = user()->id;
        $developer->save();

        return Reply::success(__('messages.recordSaved'));
    }

    public function show($id)
    {
        $this->developer = Developer::findOrFail($id);
        
        // Check view permission based on role
        $canView = $this->checkViewPermission($this->developer);
        abort_403(!$canView);

        $this->pageTitle = $this->developer->name;
        
        if (request()->ajax()) {
            return view('developers.ajax.show', $this->data);
        }

        return view('developers.show', $this->data);
    }

    public function edit($id)
    {
        $this->developer = Developer::findOrFail($id);
        
        // Check edit permission
        $canEdit = $this->checkEditPermission($this->developer);
        abort_403(!$canEdit);

        $this->pageTitle = __('app.edit') . ' ' . __('app.developer');
        
        if (request()->ajax()) {
            return view('developers.ajax.edit', $this->data);
        }

        return view('developers.edit', $this->data);
    }

    public function update(UpdateRequest $request, $id)
    {
        $developer = Developer::findOrFail($id);
        
        $canEdit = $this->checkEditPermission($developer);
        abort_403(!$canEdit);

        $developer->name = $request->name;
        $developer->description = $request->description;
        
        if ($request->hasFile('logo')) {
            $developer->logo = $this->uploadFile($request->logo, 'developers');
        }
        
        $developer->last_updated_by = user()->id;
        $developer->save();

        return Reply::success(__('messages.updateSuccess'));
    }

    public function destroy($id)
    {
        $developer = Developer::findOrFail($id);
        
        // Media Team cannot delete (no 'delete' permission)
        $canDelete = $this->checkDeletePermission($developer);
        abort_403(!$canDelete);

        $developer->delete();

        return Reply::success(__('messages.deleteSuccess'));
    }

    // Helper methods for permission checking
    private function checkViewPermission($developer)
    {
        switch ($this->viewDeveloperPermission) {
            case 'all':
                return true; // Sales Manager, Media Team Lead
            case 'added':
                return $developer->added_by == user()->id; // Media Team (own records)
            case 'owned':
                return $developer->assigned_to == user()->id; // If you have assignment logic
            case 'both':
                return $developer->added_by == user()->id || $developer->assigned_to == user()->id;
            default:
                return false;
        }
    }

    private function checkEditPermission($developer)
    {
        switch ($this->editDeveloperPermission) {
            case 'all':
                return true; // Sales Manager, Media Team Lead
            case 'added':
                return $developer->added_by == user()->id; // Media Team (own records)
            case 'owned':
                return $developer->assigned_to == user()->id;
            case 'both':
                return $developer->added_by == user()->id || $developer->assigned_to == user()->id;
            default:
                return false;
        }
    }

    private function checkDeletePermission($developer)
    {
        // Media Team has 'none' permission for delete
        switch ($this->deleteDeveloperPermission) {
            case 'all':
                return true; // Only Sales Manager, Media Team Lead
            case 'added':
                return $developer->added_by == user()->id;
            case 'owned':
                return $developer->assigned_to == user()->id;
            case 'both':
                return $developer->added_by == user()->id || $developer->assigned_to == user()->id;
            default:
                return false; // Media Team, Sales Agents
        }
    }
}