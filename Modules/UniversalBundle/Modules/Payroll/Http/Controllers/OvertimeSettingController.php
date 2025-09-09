<?php

namespace Modules\Payroll\Http\Controllers;

use App\Helper\Reply;
use App\Http\Controllers\AccountBaseController;
use App\Models\EmployeeDetails;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Modules\Payroll\DataTables\EmployeeHourlyDataTable;
use Modules\Payroll\DataTables\OvertimePolicyEmployeeDataTable;
use Modules\Payroll\Entities\OvertimePolicy;
use Modules\Payroll\Entities\PayCode;
use Modules\Payroll\Entities\PayrollSetting;

use Modules\Payroll\Http\Requests\StoreSalaryComponent;

class OvertimeSettingController extends AccountBaseController
{

    public function __construct()
    {
        parent::__construct();
        $this->pageTitle = 'payroll::app.menu.overtimeSettings';
        $this->activeSettingMenu = 'overtime_settings';
        $this->middleware(function ($request, $next) {
            abort_403(! in_array(PayrollSetting::MODULE_NAME, $this->user->modules));

            return $next($request);
        });
    }

    public function index()
    {
        $tab = request('tab');
        $this->payrollSetting = PayrollSetting::first();
        $payrollCurrency = $this->payrollSetting->currency_id;
        $this->payrollCurrency = ($this->payrollSetting->currency_id) ? $this->payrollSetting->currency_id : company()->currency_id;
        $this->defaultCurrency = ($this->payrollSetting->currency_id) ? $payrollCurrency : company()->currency_id;

        switch ($tab) {
        case 'pay-code':
            $this->payCodes = PayCode::all();

            $this->view = 'payroll::overtime-setting.ajax.pay-code';
            break;

        case 'overtime-policy':

            $this->overtimePolicies = OvertimePolicy::all();
            $this->view = 'payroll::overtime-setting.ajax.overtime-policy';
            break;

        case 'overtime-policy-employee':

            return $this->assignToEmployee();
            break;

        case 'overtime-request':

            $this->salaryTdsPermission = user()->permission('manage_salary_tds');
            abort_403($this->salaryTdsPermission !== 'all');

            $this->view = 'payroll::payroll-setting.ajax.salary-tds';
            break;

        case 'employee-hourly-rate':

            return $this->getHourlyRateData();
            break;

        default:
            $this->payCodes = PayCode::all();
            $this->view = 'payroll::overtime-setting.ajax.pay-code';
            break;
        }

        $this->activeTab = $tab ?: 'pay-code';

        if (request()->ajax()) {
            $html = view($this->view, $this->data)->render();

            return Reply::dataOnly(['status' => 'success', 'html' => $html, 'title' => $this->pageTitle, 'activeTab' => $this->activeTab]);
        }

        return view('payroll::overtime-setting.index', $this->data);
    }

    public function assignToEmployee()
    {
        $this->activeTab = 'overtime-policy-employee';

        $dataTable = new OvertimePolicyEmployeeDataTable();

        $this->overtimePolicies = OvertimePolicy::all();

        $this->employees = User::allEmployees(companyId:company()->id);

        $this->view = 'payroll::overtime-setting.ajax.overtime-policy-employee';

        return $dataTable->render('payroll::overtime-setting.index', $this->data);

    }

    public function getHourlyRateData()
    {
        $this->activeTab = 'employee-hourly-rate';

        $dataTable = new EmployeeHourlyDataTable();

        $this->employees = User::allEmployees(companyId:company()->id);

        $this->view = 'payroll::payroll-setting.ajax.employee-hourly-rate';

        return $dataTable->render('payroll::overtime-setting.index', $this->data);

    }

    /**
     * Show the form for creating a new resource.
     *
     * @return Response
     */
    public function create(Request $request)
    {
        //
    }

    /**
     * Store a newly created resource in storage.
     *
     * @param  Request  $request
     * @return Response
     */
    public function store(Request $request)
    {
        $employeeIds = $request->employee_id;
        $rate = $request->hourly_rate;

        foreach($employeeIds as $employeeId){
            if(!is_null($rate[$employeeId]))
            {
                $employee = EmployeeDetails::where('user_id', $employeeId)->first();

                $employee->overtime_hourly_rate = (isset($rate[$employeeId])) ? $rate[$employeeId] : null;
                $employee->save();
            }

        }

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
        //
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
        //
    }

    /**
     * Remove the specified resource from storage.
     *
     * @param  int  $id
     * @return Response
     */
    public function destroy($id)
    {
        //
    }

}
