<?php

namespace Modules\Payroll\DataTables;

use App\DataTables\BaseDataTable;
use App\Models\User;
use App\Scopes\ActiveScope;
use Carbon\Carbon;
use Modules\Payroll\Entities\PayrollSetting;
use Yajra\DataTables\Html\Column;

class ExpensesSalarySlipDataTable extends BaseDataTable
{

    private $viewPayrollPermission;

    public function __construct()
    {
        parent::__construct();
        $this->editPayrollPermission = user()->permission('edit_payroll');
        $this->deletePayrollPermission = user()->permission('delete_payroll');
        $this->viewPayrollPermission = user()->permission('view_payroll');
    }

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

            ->editColumn('month', function ($row) {
                return Carbon::parse($row->year . '-' . $row->month . '-01')->translatedFormat('F Y');
            })
            ->editColumn('name', function ($row) {

                return view('components.employee', [
                    'user' => $row
                ]);
            })
            ->editColumn('net_salary', function ($row) {
                return currency_format($row->net_salary, $row->currency_id);

            })

            ->editColumn('gross_salary', function ($row) {
                return currency_format($row->gross_salary, $row->currency_id);

            })

            ->editColumn('salary_status', function ($row) {
                if ($row->salary_status == 'generated') {
                    return '<span class="badge badge-success bg-dark">' . __('payroll::modules.payroll.generated') . '</span>';
                }
                elseif ($row->salary_status == 'review') {
                    return '<span class="badge badge-success bg-blue">' . __('payroll::modules.payroll.review') . '</span>';
                }
                elseif ($row->salary_status == 'locked') {
                    return '<span class="badge badge-success bg-red">' . __('payroll::modules.payroll.locked') . '</span>';
                }
                elseif ($row->salary_status == 'paid') {
                    return '<span class="badge badge-success bg-light-green">' . __('payroll::modules.payroll.paid') . '</span>';
                }

                return ucwords($row->salary_status);
            })
            ->editColumn('salary_from', function ($row) {

                if (!is_null($row->salary_from) && !is_null($row->salary_to)) {
                    $start = Carbon::parse($row->salary_from)->translatedFormat($this->company->date_format);
                    $end = Carbon::parse($row->salary_to)->translatedFormat($this->company->date_format);

                    return $start . ' ' . __('app.to') . ' ' . $end;
                }

                $start = Carbon::parse(Carbon::parse('01-' . $row->month . '-' . $row->year))->startOfMonth()->toDateString();
                $end = Carbon::parse(Carbon::parse('01-' . $row->month . '-' . $row->year))->endOfMonth()->toDateString();

                return $start . ' ' . __('app.to') . ' ' . $end;
            })
            ->editColumn('paid_on', function ($row) {
                if (!is_null($row->paid_on)) {
                    return Carbon::parse($row->paid_on)->translatedFormat($this->company->date_format);
                }
                else {
                    return '--';
                }
            })
            ->addColumn('action', function ($row) {
                $actions = '<a href="' . route('payroll.show', [$row->salary_slip_id]) . '" class="dropdown-item openRightModal"><i class="fa fa-eye mr-2"></i></a>';
                return $actions;
            })
            ->addIndexColumn()
            ->setRowId(fn($row) => 'row-' . $row->id)
            ->rawColumns(['name', 'action', 'salary_status', 'salary_from', 'check']);
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
        $expenseId = $request->expenseId;

        $users = User::withoutGlobalScope(ActiveScope::class)
            ->join('role_user', 'role_user.user_id', '=', 'users.id')
            ->leftJoin('employee_details', 'employee_details.user_id', '=', 'users.id')
            ->leftJoin('designations', 'employee_details.designation_id', '=', 'designations.id')
            ->join('salary_slips', 'salary_slips.user_id', '=', 'users.id')
            ->join('roles', 'roles.id', '=', 'role_user.role_id')
            ->join('employee_payroll_cycles', 'employee_payroll_cycles.user_id', '=', 'users.id')
            ->join('payroll_cycles', 'payroll_cycles.id', '=', 'employee_payroll_cycles.payroll_cycle_id')
            ->select('users.id', 'users.name', 'users.email', 'users.image', 'designations.name as designation_name', 'salary_slips.net_salary', 'salary_slips.gross_salary', 'salary_slips.paid_on', 'salary_slips.status as salary_status', 'salary_slips.id as salary_slip_id', 'salary_slips.added_by', 'salary_slips.month', 'salary_slips.year', 'salary_slips.currency_id')
            ->where('roles.name', '<>', 'client');

        if ($this->viewPayrollPermission == 'owned') {
            $users = $users->where('users.id', user()->id);
        }

        if ($request->searchText != '') {
            $users = $users->where(function ($query) {
                $query->where('users.name', 'like', '%' . request('searchText') . '%')
                    ->orWhere('users.email', 'like', '%' . request('searchText') . '%');
            });
        }


        $users->where('salary_slips.expense_id', $expenseId);
        $users->groupBy('users.id');
        $this->currency = PayrollSetting::with('currency')->first();

        return $users->orderBy('users.id', 'asc');
    }

    /**
     * Optional method if you want to use html builder.
     *
     * @return \Yajra\DataTables\Html\Builder
     */
    public function html()
    {
        return parent::setBuilder('expenses-salary-slip-table')
            ->parameters([
                'initComplete' => 'function () {
                    window.LaravelDataTables["expenses-salary-slip-table"].buttons().container()
                     .appendTo( "#table-actions")
                 }',
                'fnDrawCallback' => 'function( oSettings ) {
                   //
                   $(".select-picker").selectpicker();
                 }',
            ]);
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
            __('app.name') => ['data' => 'name', 'name' => 'name', 'visible' => ($this->viewPayrollPermission == 'all'), 'title' => __('app.name')],
            __('payroll::modules.payroll.netSalary') => ['data' => 'net_salary', 'name' => 'net_salary', 'title' => __('payroll::modules.payroll.netSalary')],
            __('payroll::modules.payroll.ctc') => ['data' => 'gross_salary', 'name' => 'gross_salary', 'title' => __('payroll::modules.payroll.ctc')],
            __('payroll::modules.payroll.duration') => ['data' => 'salary_from', 'name' => 'salary_from', 'title' => __('payroll::modules.payroll.duration')],
            __('modules.payments.paidOn') => ['data' => 'paid_on', 'name' => 'paid_on', 'title' => __('modules.payments.paidOn')],
            __('app.status') => ['data' => 'salary_status', 'name' => 'salary_status', 'title' => __('app.status')],
            Column::computed('action', __('app.action'))
                ->exportable(false)
                ->printable(false)
                ->orderable(false)
                ->searchable(false)
                ->addClass('text-right pr-20')
        ];
    }

}
