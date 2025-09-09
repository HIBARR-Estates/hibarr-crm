<?php

namespace Modules\Payroll\DataTables;

use Carbon\Carbon;
use App\Models\Role;
use App\Models\User;
use App\DataTables\BaseDataTable;
use Yajra\DataTables\Html\Button;
use Yajra\DataTables\Html\Column;
use Modules\Payroll\Entities\PayrollCycle;
use Modules\Payroll\Entities\EmployeeMonthlySalary;
use Modules\Payroll\Entities\PayrollCurrencySetting;
use Modules\Payroll\Entities\PayrollSetting;

class EmployeeSalaryDataTable extends BaseDataTable
{

    private $currency;
    private $cycles;

    /**
     * Build DataTable class.
     *
     * @param mixed $query Results from query() method.
     * @return \Yajra\DataTables\DataTableAbstract
     */
    public function dataTable($query)
    {


        return datatables()
            ->eloquent($query)
            ->addColumn('action', function ($row) {
                    $salary = EmployeeMonthlySalary::employeeNetSalary($row->id);
                    $action = '<div class="task_view">
                        <div class="dropdown">
                            <a class="task_view_more d-flex align-items-center justify-content-center dropdown-toggle" type="link"
                                id="dropdownMenuLink-' . $row->id . '" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                                <i class="icon-options-vertical icons"></i>
                            </a>
                            <div class="dropdown-menu dropdown-menu-right" aria-labelledby="dropdownMenuLink-' . $row->id . '" tabindex="0">';

                if ($salary['netSalary'] > 0) {
                    $action .= '<a class="dropdown-item openRightModal" href="' . route('employee-salary.edit-salary', [$row->id]) . '">
                                        <i class="fa fa-edit mr-2"></i>
                                        ' . trans('app.edit') . '
                                    </a>';
                    $action .= '<a href="javascript:;" data-user-id="' . $row->id . '" class="dropdown-item update-salary" ><i class="fa fa-plus"></i> ' .  __('payroll::modules.payroll.increment') . '</a>';
                    $action .= '<a href="javascript:;" data-user-id="' . $row->id . '" class="dropdown-item salary-history" ><i class="fa fa-eye"></i> ' .__('payroll::modules.payroll.salaryHistory'). '</a>';
                }
                else{
                    $action = '<a href="' . route('employee-salary.make-salary', [$row->id]) . '" data-user-id="' . $row->id . '" class="dropdown-item add-salary openRightModal float-left" ><i class="fa fa-plus"></i> ' .__('payroll::modules.payroll.addSalary'). '</a>';
                }

                    $action .= '</div>
                        </div>
                    </div>';

                    return $action;
            })
            ->editColumn(
                'group_name',
                function ($row) {
                    return $row->group_name ?? '--';
                }
            )
            ->addColumn('salary_cycle', function ($row) {
                $details = '<select name="cycle"  data-user-id="' . $row->id . '"  class="form-control select-picker salary-cycle">';
                $selected = '';

                foreach ($this->cycles as $cycle) {
                    if ($row->payroll_cycle_id == $cycle->id) {
                        $selected = 'selected';
                    }

                    $details .= '<option ' . $selected . ' value="' . $cycle->id . '">' . __('payroll::app.menu.' . $cycle->cycle) . '</option>';
                    $selected = '';
                }

                $details .= '</select>';

                return $details;
            })
            ->addColumn('salary_cycle_export', function ($row) {
                return $row->cycle ?? '--';
            })
            ->editColumn('allow_generate_payroll', function ($row) {

                $details = '<select name="status"  data-user-id="' . $row->id . '"  class="form-control select-picker payroll-status">';
                $selected = ($row->allow_generate_payroll == 'yes' && $row->allow_generate_payroll != '') ? 'selected' : '';
                $details .= '<option ' . $selected . ' value="yes">' . __('app.yes') . '</option>';
                $selected = ($row->allow_generate_payroll == 'no' || $row->allow_generate_payroll == '') ? 'selected' : '';
                $details .= '<option ' . $selected . ' value="no">' . __('app.no') . '</option>';
                $details .= '</select>';

                return $details;
            })
            ->addColumn('allow_generate_payroll_export', function ($row) {
                return ($row->allow_generate_payroll) ? __('app.yes') : __('app.no');
            })
            ->addColumn('gross_earning', function ($row) {
                $salary = EmployeeMonthlySalary::employeeNetSalary($row->id);

                if ($salary['netSalary'] > 0) {
                    return currency_format($salary['netSalary'], ($this->currency->currency ? $this->currency->currency->id : company()->currency->id));
                }

                return '--';
            })
            ->editColumn('name', function ($row) {
                return view('components.employee', [
                    'user' => $row
                ]);
            })
            ->addColumn('user_name', function ($row) {
                return $row->name;
            })

            ->addIndexColumn()
            ->setRowId(fn($row) => 'row-' . $row->id)
            ->rawColumns(['name', 'action', 'salary_cycle', 'allow_generate_payroll'])
            ->removeColumn('roleId')
            ->removeColumn('roleName')
            ->removeColumn('current_role');
    }

    /**
     * Get query source of dataTable.
     *
     * @param  $model
     * @return \Illuminate\Database\Eloquent\Builder
     */
    //phpcs:ignore
    public function query(User $model)
    {
        $request = $this->request();

        if ($request->role != 'all' && $request->role != '') {
            Role::findOrFail($request->role);
        }

        $this->cycles = PayrollCycle::all();
        $this->currency = PayrollSetting::with('currency')->first();
        $users = User::join('role_user', 'role_user.user_id', '=', 'users.id')
            ->leftJoin('employee_details', 'employee_details.user_id', '=', 'users.id')
            ->leftJoin('designations', 'employee_details.designation_id', '=', 'designations.id')
            ->leftJoin('employee_salary_groups', 'employee_salary_groups.user_id', '=', 'users.id')
            ->leftJoin('salary_groups', 'salary_groups.id', '=', 'employee_salary_groups.salary_group_id')
            ->leftJoin('employee_monthly_salaries', 'employee_monthly_salaries.user_id', '=', 'users.id')
            ->leftJoin('employee_payroll_cycles', 'employee_payroll_cycles.user_id', '=', 'users.id')
            ->leftJoin('payroll_cycles', 'payroll_cycles.id', '=', 'employee_payroll_cycles.payroll_cycle_id')
            ->join('roles', 'roles.id', '=', 'role_user.role_id')
            ->select('users.id', 'users.name', 'users.email', 'users.image', 'designations.name as designation_name', 'salary_groups.group_name', 'employee_payroll_cycles.payroll_cycle_id', 'employee_monthly_salaries.allow_generate_payroll', 'payroll_cycles.cycle')
            ->where('roles.name', '<>', 'client');

        if ($request->designation != 'all' && $request->designation != '') {
            $users = $users->where('employee_details.designation_id', $request->designation);
        }

        if ($request->department != 'all' && $request->department != '') {
            $users = $users->where('employee_details.department_id', $request->department);
        }

        if ($this->viewEmployeePermission == 'added') {
            $users = $users->where('employee_details.added_by', user()->id);
        }

        if ($request->searchText != '') {
            $users = $users->where(function ($query) {
                $query->where('users.name', 'like', '%' . request('searchText') . '%')
                    ->orWhere('users.email', 'like', '%' . request('searchText') . '%');
            });
        }

        return $users->groupBy('users.id');
    }

    /**
     * Optional method if you want to use html builder.
     *
     * @return \Yajra\DataTables\Html\Builder
     */
    public function html()
    {
        return parent::setBuilder('employee-salary-table')
            ->parameters([
                'initComplete' => 'function () {
                    window.LaravelDataTables["employee-salary-table"].buttons().container()
                     .appendTo( "#table-actions")
                 }',
                'fnDrawCallback' => 'function( oSettings ) {
                   //
                   $(".select-picker").selectpicker();
                 }',
            ])
            ->buttons(Button::make(['extend' => 'excel', 'text' => '<i class="fa fa-file-export"></i> ' . trans('app.exportExcel')]));
    }

    /**
     * Get columns.
     *
     * @return array
     */
    protected function getColumns()
    {
        return [
            '#' => ['data' => 'DT_RowIndex', 'orderable' => false, 'searchable' => false, 'visible' => false],
            __('app.name') => ['data' => 'name', 'name' => 'name', 'exportable' => false, 'title' => __('app.name')],
            __('app.employee') => ['data' => 'user_name', 'name' => 'name', 'visible' => false, 'title' => __('app.employee')],
            __('payroll::modules.payroll.salaryCycle') => ['data' => 'salary_cycle_export', 'name' => 'salary_cycle', 'visible' => false, 'title' => __('payroll::modules.payroll.salaryCycle')],
            __('app.employee') .'  '.__('payroll::modules.payroll.salaryCycle') => ['data' => 'salary_cycle', 'name' => 'salary_cycle', 'exportable' => false, 'title' => __('app.employee') .'  '.__('payroll::modules.payroll.salaryCycle')],
            __('payroll::modules.payroll.salaryGroup') => ['data' => 'group_name', 'name' => 'group_name', 'title' => __('payroll::modules.payroll.salaryGroup')],
            __('app.employee') . ' ' . __('payroll::modules.payroll.allow_generate_payroll') => ['data' => 'allow_generate_payroll_export', 'name' => 'allow_generate_payroll', 'visible' => false, 'title' => __('app.employee') . ' ' . __('payroll::modules.payroll.allow_generate_payroll')],
            __('payroll::modules.payroll.allow_generate_payroll') => ['data' => 'allow_generate_payroll', 'name' => 'allow_generate_payroll', 'exportable' => false, 'title' => __('payroll::modules.payroll.allow_generate_payroll')],
            __('payroll::modules.payroll.grossEarning') => ['data' => 'gross_earning', 'name' => 'name', 'visible' => true, 'title' => __('payroll::modules.payroll.netSalary') . ' (' . __('app.monthly') . ')'],

            Column::computed('action', __('app.action'))
                ->exportable(false)
                ->printable(false)
                ->orderable(false)
                ->searchable(false)
                ->addClass('text-right pr-20')
        ];
    }

}
