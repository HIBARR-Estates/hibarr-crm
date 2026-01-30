<?php

namespace App\Http\Controllers;

use App\Helper\Reply;
use App\Http\Requests\StorePackageRequest;
use App\Models\Package;
use Illuminate\Http\Request;

class PackageController extends AccountBaseController
{
    public function __construct()
    {
        parent::__construct();
        $this->pageTitle = 'app.menu.packages';
        $this->activeSettingMenu = 'packages';
        $this->middleware(function ($request, $next) {
            abort_403(user()->permission('manage_company_setting') !== 'all');

            return $next($request);
        });
    }

    public function index()
    {
        $this->packages = Package::orderBy('id', 'asc')->get();

        return view('packages.index', $this->data);
    }

    public function create()
    {
        return view('packages.create', $this->data);
    }

    public function store(StorePackageRequest $request)
    {
        Package::create([
            'name' => $request->name,
            'value' => $request->value,
            'description' => $request->description,
            'customer_type_name' => $request->customer_type_name,
            'customer_type_description' => $request->customer_type_description,
        ]);

        return Reply::success(__('messages.recordSaved'));
    }

    public function edit($id)
    {
        $this->package = Package::findOrFail($id);

        return view('packages.edit', $this->data);
    }

    public function update(StorePackageRequest $request, $id)
    {
        $package = Package::findOrFail($id);
        $package->name = $request->name;
        $package->value = $request->value;
        $package->description = $request->description;
        $package->customer_type_name = $request->customer_type_name;
        $package->customer_type_description = $request->customer_type_description;
        $package->save();

        return Reply::success(__('messages.recordSaved'));
    }

    public function destroy($id)
    {
        // Find the package - return error if not found
        $package = Package::find($id);
        
        if (!$package) {
            return Reply::error('Package not found.');
        }

        // Soft delete the package
        $package->delete();

        return Reply::success(__('messages.deleteSuccess'));
    }
}
