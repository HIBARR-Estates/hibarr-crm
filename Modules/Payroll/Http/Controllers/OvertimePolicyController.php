<?php

namespace Modules\Payroll\Http\Controllers;

use App\Helper\Reply;
use App\Http\Controllers\AccountBaseController;
use App\Models\Role;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Modules\Payroll\Entities\OvertimePolicy;
use Modules\Payroll\Entities\OvertimePolicyEmployee;
use Modules\Payroll\Entities\PayCode;
use Modules\Payroll\Entities\PayrollSetting;
use Modules\Payroll\Http\Requests\OvertimeSetting\Policy\PolicyStoreRequest;
use Modules\Payroll\Http\Requests\OvertimeSetting\Policy\PolicyUpdateRequest;

class OvertimePolicyController extends AccountBaseController
{

    public function __construct()
    {
        parent::__construct();
        $this->pageTitle = 'payroll::app.menu.overtimePolicy';

        $this->middleware(function ($request, $next) {
            abort_403(! in_array(PayrollSetting::MODULE_NAME, $this->user->modules));

            return $next($request);
        });
    }

    public function index()
    {
        //
    }

    /**
     * Show the form for creating a new resource.
     *
     * @return Response
     */
    public function create(Request $request)
    {
        $this->payCodes = PayCode::all();
        $this->roles = Role::where('name', '<>', 'admin')->where('name', '<>', 'client')->get();

        return view('payroll::overtime-setting.ajax.policy.create', $this->data);
    }

    /**
     * Store a newly created resource in storage.
     *
     * @param  Request  $request
     * @return Response
     */
    public function store(PolicyStoreRequest $request)
    {
        $overtimePolicy = new OvertimePolicy();

        $overtimePolicy->name = $request->name;
        $overtimePolicy->pay_code_id = $request->pay_code;
        $overtimePolicy->allow_roles = $request->allow_roles;
        $overtimePolicy->request_before_days = $request->request_before_days;
        $overtimePolicy->working_days = ($request->has('working_days') && $request->working_days == 'yes') ? 1 : 0;
        $overtimePolicy->week_end = ($request->has('week_end') && $request->week_end == 'yes') ? 1 : 0;
        $overtimePolicy->holiday = ($request->has('holiday') && $request->holiday == 'yes') ? 1 : 0;
        $overtimePolicy->allow_reporting_manager = ($request->has('allow_reporting_manager') && $request->allow_reporting_manager == 'yes') ? 1 : 0;
        $overtimePolicy->save();

        return Reply::success(__('messages.recordSaved'));
    }

    /**
     * Show the the specified resource.
     *
     * @param  int  $id
     * @return Response
     */
    public function show($id)
    {
        //
    }

    /**
     * Show the form for editing the specified resource.
     *
     * @param  int  $id
     * @return Response
     */
    public function edit($id)
    {
        $this->policy = OvertimePolicy::findOrFail($id);
        $this->payCodes = PayCode::all();
        $this->roles = Role::where('name', '<>', 'admin')->where('name', '<>', 'client')->get();
        return view('payroll::overtime-setting.ajax.policy.edit', $this->data);
    }

    /**
     * Update the specified resource in storage.
     *
     * @param  Request  $request
     * @param  int  $id
     * @return Response
     */
    public function update(PolicyUpdateRequest $request, $id)
    {
        $overtimePolicy = OvertimePolicy::find($id);

        $overtimePolicy->name = $request->name;
        $overtimePolicy->pay_code_id = $request->pay_code;
        $overtimePolicy->allow_roles = $request->allow_roles;
        $overtimePolicy->request_before_days = $request->request_before_days;
        $overtimePolicy->working_days = ($request->has('working_days') && $request->working_days == 'yes') ? 1 : 0;
        $overtimePolicy->week_end = ($request->has('week_end') && $request->week_end == 'yes') ? 1 : 0;
        $overtimePolicy->holiday = ($request->has('holiday') && $request->holiday == 'yes') ? 1 : 0;
        $overtimePolicy->allow_reporting_manager = ($request->has('allow_reporting_manager') && $request->allow_reporting_manager == 'yes') ? 1 : 0;
        $overtimePolicy->save();

        return Reply::success(__('messages.updateSuccess'));
    }

    /**
     * Remove the specified resource from storage.
     *
     * @param  int  $id
     * @return Response
     */
    public function destroy($id)
    {
        $overtimePolicy = OvertimePolicy::findOrFail($id);
        $overtimePolicy->delete();
        return Reply::success(__('messages.recordDeleted'));
    }

    /**
     * Remove the specified resource from storage.
     *
     * @param  int  $id
     * @return Response
     */
    public function overtimePolicyEmployee(Request $request)
    {
        $employeeIds = $request->employeeIds;
        $policyId = $request->policyId;

        foreach($employeeIds as $employeeId){

            if(is_numeric($employeeId))
            {
                $rowRecord = ['company_id' => company()->id, 'user_id' => $employeeId, 'overtime_policy_id' => $policyId];
                OvertimePolicyEmployee::updateOrCreate($rowRecord);
            }
        }

        return Reply::success(__('messages.updateSuccess'));

    }

    /**
     * Remove the specified resource from storage.
     *
     * @param  int  $id
     * @return Response
     */
    public function overtimePolicyRemove($id)
    {
        OvertimePolicyEmployee::where('user_id', $id)->delete();

        return Reply::success(__('messages.updateSuccess'));

    }

}
