<?php

namespace Modules\Payroll\Http\Controllers;

use App\Models\Team;
use App\Models\User;
use App\Helper\Reply;
use App\Models\Designation;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Modules\Payroll\Entities\PayrollCycle;
use Modules\Payroll\Http\Requests\StoreSalary;
use App\Http\Controllers\AccountBaseController;
use Carbon\Carbon;
use Modules\Payroll\Entities\EmployeeSalaryGroup;
use Modules\Payroll\Entities\EmployeePayrollCycle;
use Modules\Payroll\Entities\EmployeeMonthlySalary;
use Modules\Payroll\Entities\PayrollCurrencySetting;
use Modules\Payroll\DataTables\EmployeeSalaryDataTable;
use Modules\Payroll\Entities\EmployeeVariableComponent;
use Modules\Payroll\Entities\PayrollSetting;
use Modules\Payroll\Http\Requests\StoreEmployyeMonthlySalary;

class EmployeeMonthlySalaryController extends AccountBaseController
{

    public function __construct()
    {
        parent::__construct();
        $this->pageTitle = 'payroll::app.menu.employeeSalary';
        $this->middleware(function ($request, $next) {
            abort_403(!in_array(PayrollSetting::MODULE_NAME, $this->user->modules));

            return $next($request);
        });
    }

    /**
     * Display a listing of the resource.
     * @return Response
     */
    public function index(EmployeeSalaryDataTable $dataTable)
    {
        $viewPermission = user()->permission('manage_employee_salary');
        abort_403(!in_array($viewPermission, ['all', 'added']));

        if (!request()->ajax()) {
            $this->departments = Team::all();
            $this->designations = Designation::allDesignations();
        }

        return $dataTable->render('payroll::employee-salary.index', $this->data);
    }

    /**
     * Show the form for creating a new resource.
     * @return Response
     */
    public function create()
    {
        //
    }

    /**
     * Store a newly created resource in storage.
     * @param Request $request
     * @return Response
     */
    public function store(StoreSalary $request)
    {
        $viewPermission = user()->permission('manage_employee_salary');
        abort_403(!in_array($viewPermission, ['all', 'added']));

        $initialSalary = EmployeeMonthlySalary::where('user_id', $request->user_id)->where('type', 'initial')->first();

        if ($request->fixedAllowance < 0) {
            return Reply::error('payroll::modules.payroll.fixedAllowanceError');
        }

        if ($request->annual_salary > 0) {
            if (!is_null($initialSalary)) {
                $salary = EmployeeMonthlySalary::find($initialSalary->id);
                $salary->user_id = $request->user_id;
                $salary->annual_salary = $request->annual_salary;
                $salary->basic_salary = $request->basic_salary;
                $salary->basic_value_type = $request->basic_value;
                $salary->fixed_allowance = $request->fixedAllowance;
                $salary->amount = $request->annual_salary / 12;
                $salary->type = $request->type;
                $salary->date = now()->timezone($this->company->timezone)->toDateString();
                $salary->save();

                if (!is_null($request->deduction_variable)) {
                    foreach ($request->deduction_variable as $key => $value) {
                        $variable = new EmployeeVariableComponent();
                        $variable->monthly_salary_id = $salary->id;
                        $variable->variable_component_id = $key;
                        $variable->variable_value = $value;
                        $variable->save();
                    }
                }

                if (!is_null($request->earning_variable)) {

                    foreach ($request->earning_variable as $key => $value) {
                        $variable = new EmployeeVariableComponent();
                        $variable->monthly_salary_id = $salary->id;
                        $variable->variable_component_id = $key;
                        $variable->variable_value = $value;
                        $variable->save();
                    }
                }

            }
            else {
                $salary = new EmployeeMonthlySalary();
                $salary->user_id = $request->user_id;
                $salary->annual_salary = $request->annual_salary;
                $salary->basic_salary = $request->basic_salary;
                $salary->basic_value_type = $request->basic_value;
                $salary->fixed_allowance = $request->fixedAllowance;
                $salary->amount = $request->annual_salary / 12;
                $salary->effective_annual_salary = $request->annual_salary;
                $salary->effective_monthly_salary = $request->annual_salary / 12;
                $salary->type = $request->type;
                $salary->date = now()->timezone($this->company->timezone)->toDateString();
                $salary->save();

                if (!is_null($request->deduction_variable)) {
                    foreach ($request->deduction_variable as $key => $value) {
                        $variable = new EmployeeVariableComponent();
                        $variable->monthly_salary_id = $salary->id;
                        $variable->variable_component_id = $key;
                        $variable->variable_value = $value;
                        $variable->save();
                    }
                }

                if (!is_null($request->earning_variable)) {

                    foreach ($request->earning_variable as $key => $value) {
                        $variable = new EmployeeVariableComponent();
                        $variable->monthly_salary_id = $salary->id;
                        $variable->variable_component_id = $key;
                        $variable->variable_value = $value;
                        $variable->save();
                    }
                }
            }

            $employeeCycle = EmployeePayrollCycle::where('user_id', $request->user_id)->first();

            if (is_null($employeeCycle)) {
                $payrollCycle = PayrollCycle::where('cycle', 'monthly')->first();
                $employeeCycle = new EmployeePayrollCycle();
                $employeeCycle->user_id = $request->user_id;
                $employeeCycle->payroll_cycle_id = $payrollCycle->id;
                $employeeCycle->save();
            }
        }

        return Reply::successWithData(__('messages.recordSaved'), ['redirectUrl' => route('employee-salary.index')]);
    }

    /**
     * Show the specified resource.
     * @param int $id
     * @return Response
     */
    public function show($id)
    {
        $viewPermission = user()->permission('manage_employee_salary');
        abort_403(!in_array($viewPermission, ['all', 'added']));

        $this->employeeSalary = EmployeeMonthlySalary::employeeNetSalary($id);
        $this->employee = User::find($id);
        $this->currency = PayrollSetting::with('currency')->first();
        $this->salaryHistory = EmployeeMonthlySalary::where('user_id', $id)->orderBy('date', 'asc')->get();

        return view('payroll::employee-salary.show', $this->data);
    }

    /**
     * Show the form for editing the specified resource.
     * @param int $id
     * @return Response
     */
    public function edit($id)
    {
        $viewPermission = user()->permission('manage_employee_salary');
        abort_403(!in_array($viewPermission, ['all', 'added']));

        $this->employeeSalary = EmployeeMonthlySalary::employeeNetSalary($id);
        $this->employee = User::find($id);
        $this->currency = PayrollSetting::with('currency')->first();
        $this->salaryGroups = EmployeeSalaryGroup::with('salary_group.components', 'salary_group.components.component')->where('user_id', $id)->first();
        return view('payroll::employee-salary.increment', $this->data);
    }

    /**
     * Increment
     *
     * @param  mixed $id
     * @return void
     */
    public function increment($id)
    {
        $viewPermission = user()->permission('manage_employee_salary');
        abort_403(!in_array($viewPermission, ['all', 'added']));

        $this->employeeSalary = EmployeeMonthlySalary::employeeNetSalary($id);
        $this->employee = User::find($id);
        $this->currency = PayrollSetting::with('currency')->first();
        $this->salaryGroups = EmployeeSalaryGroup::with('salary_group.components', 'salary_group.components.component')->where('user_id', $id)->first();
        return view('payroll::employee-salary.increment', $this->data);
    }

    /**
     * UpdateIncrement
     *
     * @param  mixed $request
     * @param  mixed $id
     * @return void
     */
    //phpcs:ignore
    public function incrementStore(StoreEmployyeMonthlySalary $request, $id)
    {
        $viewPermission = user()->permission('manage_employee_salary');
        abort_403(!in_array($viewPermission, ['all', 'added']));

        $this->id = $id;

        $date = Carbon::createFromFormat($this->company->date_format, $request->date)->format('Y-m-d');


        $salary = new EmployeeMonthlySalary();
        $salary->user_id = $request->user_id;
        $salary->annual_salary = $request->annual_salary;

        $salary->amount = $request->annual_salary / 12;
        $salary->type = $request->type;
        $salary->date = $date;
        $salary->save();

        return Reply::success(__('messages.recordSaved'));
    }

    public function incrementEdit(Request $request)
    {
        $salaryId = $request->salaryId;
        $viewPermission = user()->permission('manage_employee_salary');
        abort_403(!in_array($viewPermission, ['all', 'added']));

        $this->employeeSalary = EmployeeMonthlySalary::where('id', $salaryId)->first();
        $userId = $this->employeeSalary->user_id;
        $this->employee = User::find($userId);
        $this->currency = PayrollSetting::with('currency')->first();
        $this->salaryGroups = EmployeeSalaryGroup::with('salary_group.components', 'salary_group.components.component')->where('user_id', $userId)->first();
        return view('payroll::employee-salary.edit-increment', $this->data);
    }

    public function incrementUpdate(Request $request)
    {
        $viewPermission = user()->permission('manage_employee_salary');
        abort_403(!in_array($viewPermission, ['all', 'added']));
        $id = $request->salaryId;

        $salary = EmployeeMonthlySalary::findOrFail($id);
        $salary->user_id = $request->user_id;
        $salary->annual_salary = $request->annual_salary;
        $salary->amount = $request->annual_salary / 12;
        $salary->type = $request->type;
        $salary->date = now()->timezone($this->company->timezone)->toDateString();
        $salary->save();

        return Reply::success(__('messages.recordSaved'));
    }

    /**
     * Update the specified resource in storage.
     * @param Request $request
     * @param int $id
     * @return Response
     */
    //phpcs:ignore
    public function update(StoreEmployyeMonthlySalary $request, $id)
    {
        $viewPermission = user()->permission('manage_employee_salary');
        abort_403(!in_array($viewPermission, ['all', 'added']));

        $this->id = $id;

        $salary = new EmployeeMonthlySalary();
        $salary->user_id = $request->user_id;
        $salary->annual_salary = $request->annual_salary;

        $salary->amount = $request->annual_salary / 12;
        $salary->type = $request->type;
        $salary->date = now()->timezone($this->company->timezone)->toDateString();
        $salary->save();

        return Reply::success(__('messages.recordSaved'));
    }

    /**
     * Remove the specified resource from storage.
     * @param int $id
     * @return Response
     */
    public function destroy($id)
    {
        $viewPermission = user()->permission('manage_employee_salary');
        abort_403(!in_array($viewPermission, ['all', 'added']));

        EmployeeMonthlySalary::destroy($id);

        return Reply::success(__('messages.deleteSuccess'));
    }

    public function employeePayrollCycle(Request $request)
    {
        $employeeCycle = EmployeePayrollCycle::where('user_id', $request->user_id)->first();

        if (!$employeeCycle) {
            $employeeCycle = new EmployeePayrollCycle();
            $employeeCycle->user_id = $request->user_id;
        }

        $employeeCycle->payroll_cycle_id = $request->cycle;
        $employeeCycle->save();

        return Reply::success(__('messages.updateSuccess'));
    }

    public function employeePayrollStatus(Request $request)
    {

        $employeeMonthly = EmployeeMonthlySalary::where('user_id', $request->user_id)->get();

        if (count($employeeMonthly) > 0) {

            foreach ($employeeMonthly as $status) {
                $status->allow_generate_payroll = $request->status;
                $status->save();
            }

        }
        else {

            $employeeMonthly = new EmployeeMonthlySalary();
            $employeeMonthly->user_id = $request->user_id;
            $employeeMonthly->annual_salary = 0;
            $employeeMonthly->basic_salary = 0;
            $employeeMonthly->basic_value_type = 'fixed';
            $employeeMonthly->amount = 0;
            $employeeMonthly->type = 'initial';
            $employeeMonthly->allow_generate_payroll = $request->status;
            $employeeMonthly->date = now()->timezone($this->company->timezone)->toDateString();
            $employeeMonthly->save();

            $employeeCycle = EmployeePayrollCycle::where('user_id', $request->user_id)->first();

            if (is_null($employeeCycle)) {
                $payrollCycle = PayrollCycle::where('cycle', 'monthly')->first();
                $employeeCycle = new EmployeePayrollCycle();
                $employeeCycle->user_id = $request->user_id;
                $employeeCycle->payroll_cycle_id = $payrollCycle->id;
                $employeeCycle->save();
            }
        }

        return Reply::success(__('messages.updateSuccess'));
    }

    public function makeSalary($id)
    {

        $this->user_id = $id;
        $this->employee = User::findOrFail($id);
        $this->salaryGroup = EmployeeSalaryGroup::with('salary_group.components', 'salary_group.components.component')->where('user_id', $id)->first();
        $this->payrollController = new EmployeeMonthlySalaryController();
        $this->currency = PayrollSetting::with('currency')->first();

        if (request()->ajax()) {
            $this->pageTitle = __('payroll::app.menu.payroll');
            $html = view('payroll::employee-salary.ajax.create', $this->data)->render();

            return Reply::dataOnly(['status' => 'success', 'html' => $html, 'title' => $this->pageTitle]);
        }

        $this->view = 'payroll::employee-salary.ajax.create';

        return view('payroll::employee-salary.create', $this->data);
    }

    public function getSalary(Request $request)
    {

        if ($request->basicType == 'fixed') {
            $this->basicSalary = $request->basicValue;

        }
        else {
            $this->basicSalary = ($request->annualSalary / 12) / 100 * $request->basicValue;
        }

        $this->annualSalary = $request->annualSalary;
        $this->salaryGroup = EmployeeSalaryGroup::with('salary_group.components', 'salary_group.components.component')->where('user_id', $request->userId)->first();

        $this->currency = PayrollSetting::with('currency')->first();

        $this->basicType = $request->basicType;
        $this->basicValue = $request->basicValue;
        $totalEarnings = [];
        $totalExpenses = [];

        $this->payrollController = new EmployeeMonthlySalaryController();

        if (!is_null($this->salaryGroup)) {

            foreach ($this->salaryGroup->salary_group->components as $component) {

                if ($component->component->component_type == 'earning') {
                    if ($component->component->value_type == 'fixed') {
                        $totalEarnings[] += $component->component->component_value;
                    }

                    if ($component->component->value_type == 'percent') {
                        $totalEarnings[] += ($request->annualSalary / 12) / 100 * $component->component->component_value;
                    }

                    if ($component->component->value_type == 'basic_percent') {
                        $totalEarnings[] += $this->basicSalary / 100 * $component->component->component_value;
                    }

                    if ($component->component->value_type == 'variable') {

                        $totalEarnings[] = $component->component->component_value;
                    }
                }
                else {

                    if ($component->component->value_type == 'fixed') {
                        $totalExpenses[] = $component->component->component_value;
                    }

                    if ($component->component->value_type == 'percent') {
                        $totalExpenses[] = ($request->annualSalary / 12) / 100 * $component->component->component_value;
                    }

                    if ($component->component->value_type == 'basic_percent') {
                        $totalExpenses[] = $this->basicSalary / 100 * $component->component->component_value;
                    }

                    if ($component->component->value_type == 'variable') {
                        $totalExpenses[] = $component->component->component_value;
                    }
                }
            }
        }

        $this->totalEarnings = $totalEarnings;
        $this->totalExpenses = $totalExpenses;
        $this->expenses = array_sum($totalExpenses);

        $this->fixedAllowance = (($request->annualSalary / 12) - ($this->basicSalary + array_sum($totalEarnings)));

        $view = view('payroll::employee-salary.ajax.salary-component', $this->data)->render();

        return Reply::dataOnly(['status' => 'success', 'component' => $view, 'id' => $request->userId]);
    }

    public function getUpdateSalary(Request $request)
    {
        $this->deductionTotalWithoutVar = 0;

        if ($request->basicType == 'fixed') {
            $this->basicSalary = $request->basicValue;

        }
        else {
            $this->basicSalary = ($request->annualSalary / 12) / 100 * $request->basicValue;
        }

        $this->annualSalary = $request->annualSalary;
        $this->salaryGroup = EmployeeSalaryGroup::with('salary_group.components', 'salary_group.components.component')->where('user_id', $request->userId)->first();
        $this->employeeMonthlySalary = EmployeeMonthlySalary::where('user_id', $request->userId)->first();
        $this->employeeVariableSalaries = EmployeeVariableComponent::with('component')->where('monthly_salary_id', $this->employeeMonthlySalary->id)->get() ?? [''];
        $this->currency = PayrollSetting::with('currency')->first();

        $this->basicType = $request->basicType;
        $this->basicValue = $request->basicValue;
        $totalEarnings = [];
        $totalExpenses = [];

        $this->payrollController = new EmployeeMonthlySalaryController();

        if (!is_null($this->salaryGroup)) {
            foreach ($this->salaryGroup->salary_group->components as $component) {

                if ($component->component->component_type == 'earning') {
                    if ($component->component->value_type == 'fixed') {
                        $totalEarnings[] += $component->component->component_value;
                    }

                    if ($component->component->value_type == 'percent') {
                        $totalEarnings[] += ($this->employeeMonthlySalary->annual_salary / 12) / 100 * $component->component->component_value;
                    }

                    if ($component->component->value_type == 'basic_percent') {
                        $totalEarnings[] += $this->basicSalary / 100 * $component->component->component_value;
                    }

                    if ($component->component->value_type == 'variable') {
                        $compValue = $this->employeeVariableSalaries->where('variable_component_id', $component->component->id)->first();

                        if($compValue){
                            $totalEarnings[] = $compValue->variable_value;
                        }
                        else{
                            $totalEarnings[] = $component->component->component_value;
                        }
                    }
                }
                else {

                    if ($component->component->value_type == 'fixed') {
                        $totalExpenses[] = $component->component->component_value;
                    }

                    if ($component->component->value_type == 'percent') {
                        $totalExpenses[] = ($this->employeeMonthlySalary->annual_salary / 12) / 100 * $component->component->component_value;
                    }

                    if ($component->component->value_type == 'basic_percent') {
                        $totalExpenses[] = $this->basicSalary / 100 * $component->component->component_value;
                    }

                    if ($component->component->value_type == 'variable') {
                        $compValueDeduction = $this->employeeVariableSalaries->where('variable_component_id', $component->component->id)->first();

                        if($compValueDeduction){
                            $totalExpenses[] = $compValueDeduction->variable_value;
                            $this->deductionTotalWithoutVar = array_sum($totalExpenses);
                        }
                        else{
                            $totalExpenses[] = $component->component->component_value;
                            $this->deductionTotalWithoutVar = array_sum($totalExpenses);
                        }
                    }
                }
            }
        }


        $this->totalEarnings = $totalEarnings;
        $this->totalExpenses = $totalExpenses;
        $this->expenses = array_sum($totalExpenses);

        $this->fixedAllowance = (($request->annualSalary / 12) - ($this->basicSalary + array_sum($totalEarnings)));

        $view = view('payroll::employee-salary.ajax.salary-update-component', $this->data)->render();

        return Reply::dataOnly(['status' => 'success', 'component' => $view, 'id' => $request->userId]);
    }

    public function editSalary($id)
    {
        $this->user_id = $id;
        $this->employee = User::findOrFail($id);
        $this->salaryGroup = EmployeeSalaryGroup::with('salary_group.components', 'salary_group.components.component')->where('user_id', $id)->first();
        $this->employeeMonthlySalary = EmployeeMonthlySalary::where('user_id', $id)->first();
        $this->payrollController = new EmployeeMonthlySalaryController();
        $this->currency = PayrollSetting::with('currency')->first();
        $this->employeeVariableSalaries = EmployeeVariableComponent::with('component')->where('monthly_salary_id', $this->employeeMonthlySalary->id)->get() ?? [''];

        if ($this->employeeMonthlySalary->basic_value_type == 'fixed') {
            $this->basicSalary = $this->employeeMonthlySalary->basic_salary;
        }
        else {
            $this->basicSalary = ($this->employeeMonthlySalary->annual_salary / 12) / 100 * $this->employeeMonthlySalary->basic_salary;
        }

        $totalEarnings = [];
        $totalExpenses = [];
        $this->deductionTotalWithoutVar = 0;

        if (!is_null($this->salaryGroup)) {

            foreach ($this->salaryGroup->salary_group->components as $component) {

                if ($component->component->component_type == 'earning') {
                    if ($component->component->value_type == 'fixed') {
                        $totalEarnings[] += $component->component->component_value;
                    }

                    if ($component->component->value_type == 'percent') {
                        $totalEarnings[] += ($this->employeeMonthlySalary->annual_salary / 12) / 100 * $component->component->component_value;
                    }

                    if ($component->component->value_type == 'basic_percent') {
                        $totalEarnings[] += $this->basicSalary / 100 * $component->component->component_value;
                    }

                    if ($component->component->value_type == 'variable') {
                        $compValue = $this->employeeVariableSalaries->where('variable_component_id', $component->component->id)->first() ?? null;

                        if($compValue){
                            $totalEarnings[] = $compValue->variable_value;
                        }
                        else{
                            $totalEarnings[] = $component->component->component_value;
                        }
                    }
                }
                else {

                    if ($component->component->value_type == 'fixed') {
                        $totalExpenses[] = $component->component->component_value;
                    }

                    if ($component->component->value_type == 'percent') {
                        $totalExpenses[] = ($this->employeeMonthlySalary->annual_salary / 12) / 100 * $component->component->component_value;
                    }

                    if ($component->component->value_type == 'basic_percent') {
                        $totalExpenses[] = $this->basicSalary / 100 * $component->component->component_value;
                    }


                    if ($component->component->value_type == 'variable') {
                        $compValueDeduction = $this->employeeVariableSalaries->where('variable_component_id', $component->component->id)->first();

                        if($compValueDeduction){
                            $totalExpenses[] = $compValueDeduction->variable_value;
                            $this->deductionTotalWithoutVar = array_sum($totalExpenses);

                        }
                        else{
                            $totalExpenses[] = $component->component->component_value;
                            $this->deductionTotalWithoutVar = array_sum($totalExpenses);
                        }
                    }
                }
            }
        }

        $this->totalEarnings = $totalEarnings;
        $this->totalExpenses = $totalExpenses;
        $this->expenses = array_sum($totalExpenses);


        $this->fixedAllowance = is_int($this->employeeMonthlySalary->fixed_allowance) ? $this->employeeMonthlySalary->fixed_allowance : 0;

        if (request()->ajax()) {
            $this->pageTitle = __('payroll::app.menu.payroll');
            $html = view('payroll::employee-salary.ajax.edit', $this->data)->render();

            return Reply::dataOnly(['status' => 'success', 'html' => $html, 'title' => $this->pageTitle]);
        }

        $this->view = 'payroll::employee-salary.ajax.edit';

        return view('payroll::employee-salary.create', $this->data);
    }

    public function updateSalary(Request $request, $id)
    {
        $salary = EmployeeMonthlySalary::where('id', $id)->where('type', 'initial')->first();

        if ($request->fixedAllowance < 0) {
            return Reply::error('payroll::modules.payroll.fixedAllowanceError');
        }

        if ($request->annual_salary > 0) {
            $salary->user_id = $request->user_id;
            $salary->effective_annual_salary = $request->annual_salary;
            $salary->basic_salary = $request->basic_salary;
            $salary->basic_value_type = $request->basic_value;
            $salary->effective_monthly_salary = $request->annual_salary / 12;
            $salary->type = $request->type;
            $salary->fixed_allowance = $request->fixedAllowance;
            $salary->date = now()->timezone($this->company->timezone)->toDateString();
            $salary->save();
            EmployeeVariableComponent::where('monthly_salary_id', $salary->id)->delete();

            if (!is_null($request->deduction_variable)) {
                foreach ($request->deduction_variable as $key => $value) {
                    $variable = new EmployeeVariableComponent();
                    $variable->monthly_salary_id = $salary->id;
                    $variable->variable_component_id = $key;
                    $variable->variable_value = $value;
                    $variable->save();
                }
            }

            if (!is_null($request->earning_variable)) {
                foreach ($request->earning_variable as $key => $value) {
                    $variable = new EmployeeVariableComponent();
                    $variable->monthly_salary_id = $salary->id;
                    $variable->variable_component_id = $key;
                    $variable->variable_value = $value;
                    $variable->save();
                }
            }

            $employeeCycle = EmployeePayrollCycle::where('user_id', $request->user_id)->first();

            if (is_null($employeeCycle)) {
                $payrollCycle = PayrollCycle::where('cycle', 'monthly')->first();
                $employeeCycle = new EmployeePayrollCycle();
                $employeeCycle->user_id = $request->user_id;
                $employeeCycle->payroll_cycle_id = $payrollCycle->id;
                $employeeCycle->save();
            }
        }

        return Reply::successWithData(__('messages.updateSuccess'), ['redirectUrl' => route('employee-salary.index')]);
    }

    public function currencyFormatterCustom($amount)
    {
        $formats = currency_format_setting();

        $no_of_decimal = !is_null($formats->no_of_decimal) ? $formats->no_of_decimal : '0';
        $thousand_separator = !is_null($formats->thousand_separator) ? $formats->thousand_separator : '';
        $decimal_separator = !is_null($formats->decimal_separator) ? $formats->decimal_separator : '0';

        return number_format($amount, $no_of_decimal, $decimal_separator, $thousand_separator);
    }

}
