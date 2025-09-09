<?php

namespace Modules\Payroll\Http\Controllers;

use App\Helper\Reply;
use App\Http\Controllers\AccountBaseController;
use App\Models\EmployeeDetails;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Modules\Payroll\Entities\PayrollSetting;

class SalarySettingController extends AccountBaseController
{
    public function __construct()
    {
        parent::__construct();
        $this->middleware(function ($request, $next) {
            abort_403(! in_array(PayrollSetting::MODULE_NAME, $this->user->modules));

            return $next($request);
        });
    }

    /**
     * Display a listing of the resource.
     *
     * @return Response
     */
    public function index()
    {
        //
    }

    /**
     * Show the form for creating a new resource.
     *
     * @return Response
     */
    public function create()
    {
        //
    }

    /**
     * Store a newly created resource in storage.
     *
     * @return Response
     */
    public function store(Request $request)
    {

        $valArray = [];
        $employee = new EmployeeDetails;
        $fields = $employee->getCustomFieldGroupsWithFields()->fields;

        if ($request->has('select_all_field')) {
            $valArray = json_encode($fields->pluck('id')->toArray());

        } else {

            foreach ($fields as $field) {
                if ($request->has($field->name)) {
                    array_push($valArray, $field->id);
                }
            }

            $valArray = json_encode($valArray);
        }

        $PayrollSetting = PayrollSetting::first();
        $PayrollSetting->extra_fields = $valArray;
        $PayrollSetting->save();

        return Reply::success(__('messages.recordSaved'));
    }

    /**
     * Update the specified resource in storage.
     *
     * @param  int  $id
     * @return Response
     */
    public function update(Request $request, $id)
    {
        $valArray = [];

        $employee = new EmployeeDetails;
        $fields = $employee->getCustomFieldGroupsWithFields()->fields;

        if ($request->has('select_all_field')) {
            $valArray = json_encode($fields->pluck('id')->toArray());

        } else {
            foreach ($fields as $field) {
                if ($request->has($field->name)) {
                    array_push($valArray, $field->id);
                }
            }

            $valArray = json_encode($valArray);
        }

        PayrollSetting::where('id', $id)->update([
            'extra_fields' => $valArray,
        ]);

        return Reply::success(__('messages.recordSaved'));
    }
}
