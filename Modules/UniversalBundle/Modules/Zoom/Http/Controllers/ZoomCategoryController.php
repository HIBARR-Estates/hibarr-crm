<?php

namespace Modules\Zoom\Http\Controllers;

use App\Helper\Reply;
use App\Http\Controllers\AccountBaseController;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Modules\Zoom\Entities\ZoomCategory;
use Modules\Zoom\Entities\ZoomSetting;
use Modules\Zoom\Http\Requests\Category\StoreCategory;

class ZoomCategoryController extends AccountBaseController
{
    public function __construct()
    {
        parent::__construct();
        $this->middleware(function ($request, $next) {
            abort_403(! in_array(ZoomSetting::MODULE_NAME, $this->user->modules));

            return $next($request);
        });
    }

    public function index()
    {
        return view('zoom::index');
    }

    /**
     * Show the form for creating a new resource.
     *
     * @return Response
     */
    public function create()
    {
        $this->addPermission = user()->permission('manage_zoom_category');

        abort_403(! in_array($this->addPermission, ['all', 'added']));

        $this->categories = ZoomCategory::all();

        return view('zoom::category.create', $this->data);
    }

    /**
     * Store a newly created resource in storage.
     *
     * @param  Request  $request
     * @return Response
     */
    public function store(StoreCategory $request)
    {
        $category = new ZoomCategory;
        $category->category_name = $request->category_name;
        $category->save();

        $categories = ZoomCategory::all();
        $options = '<option value="">--</option>';

        foreach ($categories as $item) {
            $selected = '';

            if ($item->id == $category->id) {
                $selected = 'selected';
            }

            $options .= '<option '.$selected.' value="'.$item->id.'"> '.$item->category_name.' </option>';
        }

        return Reply::successWithData(__('messages.recordSaved'), ['data' => $options]);
    }

    /**
     * Show the specified resource.
     *
     * @param  int  $id
     * @return Response
     */
    //phpcs:ignore
    public function show($id)
    {
        return view('zoom::show');
    }

    /**
     * Show the form for editing the specified resource.
     *
     * @param  int  $id
     * @return Response
     */
    //phpcs:ignore
    public function edit($id)
    {
        return view('zoom::edit');
    }

    /**
     * Update the specified resource in storage.
     *
     * @param  Request  $request
     * @param  int  $id
     * @return Response
     */
    public function update(StoreCategory $request, $id)
    {
        $category = ZoomCategory::find($id);
        $category->category_name = strip_tags($request->category_name);
        $category->save();

        $categories = ZoomCategory::all();
        $options = '<option value="">--</option>';

        foreach ($categories as $item) {
            $options .= '<option value="'.$item->id.'"> '.$item->category_name.' </option>';
        }

        return Reply::successWithData(__('messages.updateSuccess'), ['data' => $options]);
    }

    /**
     * Remove the specified resource from storage.
     *
     * @param  int  $id
     * @return Response
     */
    public function destroy($id)
    {
        ZoomCategory::destroy($id);

        $categories = ZoomCategory::all();
        $options = '<option value="">--</option>';

        foreach ($categories as $item) {
            $options .= '<option value="'.$item->id.'"> '.$item->category_name.' </option>';
        }

        return Reply::successWithData(__('messages.deleteSuccess'), ['data' => $options]);
    }
}
