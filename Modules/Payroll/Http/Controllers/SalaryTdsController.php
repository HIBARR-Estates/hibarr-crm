<?php

namespace Modules\Payroll\Http\Controllers;

use App\Helper\Reply;
use App\Http\Controllers\AccountBaseController;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Modules\Payroll\Entities\PayrollSetting;
use Modules\Payroll\Entities\SalaryTds;
use Modules\Payroll\Http\Requests\StoreSalaryTds;

class SalaryTdsController extends AccountBaseController
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
        $this->salaryGroupPermission = user()->permission('manage_salary_tds');
        abort_403($this->salaryGroupPermission !== 'all');

        $this->payrollSetting = PayrollSetting::first();

        return view('payroll::payroll-setting.create-salary-tds-modal', $this->data);

    }

    /**
     * Store a newly created resource in storage.
     *
     * @param  Request  $request
     * @return array
     */
    public function store(StoreSalaryTds $request)
    {
        $this->salaryGroupPermission = user()->permission('manage_salary_tds');
        abort_403($this->salaryGroupPermission !== 'all');

        SalaryTds::create($request->all());

        return Reply::success(__('messages.recordSaved'));
    }

    /**
     * Show the form for editing the specified resource.
     *
     * @param  int  $id
     * @return \Illuminate\Contracts\Foundation\Application|\Illuminate\Contracts\View\Factory|\Illuminate\Contracts\View\View
     */
    public function edit($id)
    {
        $this->salaryGroupPermission = user()->permission('manage_salary_tds');
        abort_403($this->salaryGroupPermission !== 'all');

        $this->salaryTds = SalaryTds::find($id);

        return view('payroll::payroll-setting.edit-salary-tds-modal', $this->data);
    }

    /**
     * Update the specified resource in storage.
     *
     * @param  Request  $request
     * @param  int  $id
     * @return Response
     */
    public function update(StoreSalaryTds $request, $id)
    {
        $this->salaryGroupPermission = user()->permission('manage_salary_tds');
        abort_403($this->salaryGroupPermission !== 'all');

        SalaryTds::where('id', $id)->update([
            'salary_from' => $request->salary_from,
            'salary_to' => $request->salary_to,
            'salary_percent' => $request->salary_percent,
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
        $this->salaryGroupPermission = user()->permission('manage_salary_tds');
        abort_403($this->salaryGroupPermission !== 'all');

        SalaryTds::destroy($id);

        return Reply::success(__('messages.deleteSuccess'));
    }

    public function getStatus()
    {
        $this->salaryGroupPermission = user()->permission('manage_salary_tds');
        abort_403($this->salaryGroupPermission !== 'all');

        $this->payrollSetting = PayrollSetting::first();
        $this->currency = $payrollSetting->currency ?? company()->currency;

        return view('payroll::payroll-setting.salary-tds-status-modal', $this->data);
    }

    public function status(Request $request)
    {
        $this->salaryGroupPermission = user()->permission('manage_salary_tds');
        abort_403($this->salaryGroupPermission !== 'all');
        $this->currency = $payrollSetting->currency ?? company()->currency;

        PayrollSetting::where('company_id', company()->id)->update([
            'tds_status' => $request->has('status') && $request->status == 'on' ? 1 : 0,
            'finance_month' => $request->finance_month,
            'tds_salary' => $request->tds_salary,
        ]);

        return Reply::success(__('messages.updateSuccess'));
    }

}
