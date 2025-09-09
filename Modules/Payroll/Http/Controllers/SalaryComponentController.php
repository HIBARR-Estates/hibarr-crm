<?php

namespace Modules\Payroll\Http\Controllers;

use App\Helper\Reply;
use App\Http\Controllers\AccountBaseController;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Modules\Payroll\Entities\PayrollSetting;
use Modules\Payroll\Entities\SalaryComponent;
use Modules\Payroll\Http\Requests\StoreSalaryComponent;

class SalaryComponentController extends AccountBaseController
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
        $this->salaryComponentPermission = user()->permission('manage_salary_component');
        abort_403($this->salaryComponentPermission !== 'all');

        return view('payroll::payroll-setting.create-salary-component-modal');
    }

    /**
     * Store a newly created resource in storage.
     *
     * @param  Request  $request
     * @return Response
     */
    public function store(StoreSalaryComponent $request)
    {
        $this->salaryComponentPermission = user()->permission('manage_salary_component');
        abort_403($this->salaryComponentPermission !== 'all');

        SalaryComponent::create($request->all());

        return Reply::success(__('messages.recordSaved'));
    }

    /**
     * Show the form for editing the specified resource.
     *
     * @param  int  $id
     * @return Response
     */
    public function edit($id)
    {
        $this->salaryComponentPermission = user()->permission('manage_salary_component');
        abort_403($this->salaryComponentPermission !== 'all');

        $this->salaryComponent = SalaryComponent::find($id);

        return view('payroll::payroll-setting.edit-salary-component-modal', $this->data);
    }

    /**
     * Update the specified resource in storage.
     *
     * @param  Request  $request
     * @param  int  $id
     * @return Response
     */
    public function update(StoreSalaryComponent $request, $id)
    {
        $this->salaryComponentPermission = user()->permission('manage_salary_component');
        abort_403($this->salaryComponentPermission !== 'all');

        SalaryComponent::where('id', $id)->update([
            'component_name' => $request->component_name,
            'component_type' => $request->component_type,
            'component_value' => $request->component_value,
            'weekly_value' => $request->weekly_value,
            'biweekly_value' => $request->biweekly_value,
            'semimonthly_value' => $request->semimonthly_value,
            'value_type' => $request->value_type,
        ]);

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
        $this->salaryComponentPermission = user()->permission('manage_salary_component');
        abort_403($this->salaryComponentPermission !== 'all');

        SalaryComponent::destroy($id);

        return Reply::success(__('messages.deleteSuccess'));
    }
}
