<?php

namespace Modules\Payroll\Http\Controllers;

use App\Helper\Reply;
use App\Http\Controllers\AccountBaseController;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Modules\Payroll\Entities\EmployeeSalaryGroup;
use Modules\Payroll\Entities\PayrollSetting;
use Modules\Payroll\Entities\SalaryComponent;
use Modules\Payroll\Entities\SalaryGroup;
use Modules\Payroll\Entities\SalaryGroupComponent;
use Modules\Payroll\Http\Requests\StoreEmployeeSalaryGroup;
use Modules\Payroll\Http\Requests\StoreSalaryGroup;

class SalaryGroupController extends AccountBaseController
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
        $this->salaryGroupPermission = user()->permission('manage_salary_group');
        abort_403($this->salaryGroupPermission !== 'all');

        $this->salaryComponents = SalaryComponent::all();

        return view('payroll::payroll-setting.create-salary-group-modal', $this->data);

    }

    /**
     * Store a newly created resource in storage.
     *
     * @param  Request  $request
     * @return Response
     */
    public function store(StoreSalaryGroup $request)
    {
        $this->salaryGroupPermission = user()->permission('manage_salary_group');

        abort_403($this->salaryGroupPermission !== 'all');

        $salaryGroup = SalaryGroup::create(['group_name' => $request->group_name]);

        foreach ($request->salary_components as $component) {
            SalaryGroupComponent::create(
                [
                    'salary_group_id' => $salaryGroup->id,
                    'salary_component_id' => $component,
                ]
            );
        }

        return Reply::success(__('messages.recordSaved'));
    }

    /**
     * Show the specified resource.
     *
     * @param  int  $id
     * @return Response
     */
    public function show($id)
    {
        $this->salaryGroupPermission = user()->permission('manage_salary_group');
        abort_403($this->salaryGroupPermission !== 'all');

        $this->salaryGroup = SalaryGroup::with('employee')->findOrFail($id);
        $this->selectedEmp = $this->salaryGroup->employee->pluck('user_id')->toArray();

        $this->anotherUsers = EmployeeSalaryGroup::where('salary_group_id', '<>', $this->salaryGroup->id)->pluck('user_id')->toArray();

        $this->employees = User::join('role_user', 'role_user.user_id', '=', 'users.id')
            ->join('roles', 'roles.id', '=', 'role_user.role_id')
            ->leftJoin('employee_salary_groups', 'employee_salary_groups.user_id', '=', 'users.id')
            ->leftJoin('salary_groups', 'salary_groups.id', '=', 'employee_salary_groups.salary_group_id')
            ->select('users.id', 'users.name', 'users.email', 'salary_groups.group_name', 'users.image')
            ->where('roles.name', '<>', 'client')
            ->whereNotIn('users.id', $this->anotherUsers)
            ->groupBy('users.id')
            ->orderBy('users.name')
            ->get();

        return view('payroll::payroll-setting.manage-employee-modal', $this->data);

    }

    public function manageEmployee(StoreEmployeeSalaryGroup $request)
    {

        $this->salaryGroupPermission = user()->permission('manage_salary_group');
        abort_403($this->salaryGroupPermission !== 'all');

        EmployeeSalaryGroup::where('salary_group_id', $request->salary_group_id)->delete();
        $salaryGroup = SalaryGroup::find($request->salary_group_id);
        $salaryGroup->employees()->sync($request->user_id);

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
        $this->salaryGroupPermission = user()->permission('manage_salary_group');
        abort_403($this->salaryGroupPermission !== 'all');

        $this->salaryGroup = SalaryGroup::with('components')->find($id);
        $this->salaryComponents = SalaryComponent::all();

        return view('payroll::payroll-setting.edit-salary-group-modal', $this->data);
    }

    /**
     * Update the specified resource in storage.
     *
     * @param  Request  $request
     * @param  int  $id
     * @return Response
     */
    public function update(StoreSalaryGroup $request, $id)
    {
        $this->salaryGroupPermission = user()->permission('manage_salary_group');
        abort_403($this->salaryGroupPermission !== 'all');

        SalaryGroup::where('id', $id)->update([
            'group_name' => $request->group_name,
        ]);

        SalaryGroupComponent::where('salary_group_id', $id)->delete();

        foreach ($request->salary_components as $component) {
            SalaryGroupComponent::create(
                [
                    'salary_group_id' => $id,
                    'salary_component_id' => $component,
                ]
            );
        }

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
        $this->salaryGroupPermission = user()->permission('manage_salary_group');
        abort_403($this->salaryGroupPermission !== 'all');

        SalaryGroup::destroy($id);

        return Reply::success(__('messages.deleteSuccess'));
    }
}
