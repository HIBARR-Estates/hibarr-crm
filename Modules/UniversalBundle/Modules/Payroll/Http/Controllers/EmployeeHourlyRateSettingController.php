<?php

namespace Modules\Payroll\Http\Controllers;

use App\Helper\Reply;
use App\Http\Controllers\AccountBaseController;
use App\Models\EmployeeDetails;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Modules\Payroll\DataTables\EmployeeHourlyDataTable;
use Modules\Payroll\Entities\PayrollSetting;

use Modules\Payroll\Http\Requests\StoreSalaryComponent;

class EmployeeHourlyRateSettingController extends AccountBaseController
{

    public function __construct()
    {
        parent::__construct();
        $this->pageTitle = 'payroll::app.menu.payrollEmployeeHourlyRateSettings';
        $this->activeSettingMenu = 'payroll_settings';
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
    public function index(EmployeeHourlyDataTable $dataTable)
    {
        $this->view = 'payroll::payroll-setting.ajax.employee-hourly-rate';

        return $dataTable->render('payroll::payroll-setting.index', $this->data);
    }

    /**
     * Show the form for creating a new resource.
     *
     * @return Response
     */
    public function create(Request $request)
    {
        //

        //return Reply::dataOnly(['viewData' => $view]);

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
