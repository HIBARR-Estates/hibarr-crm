<?php

namespace Modules\Payroll\DataTables;

use App\DataTables\BaseDataTable;
use App\Models\EmployeeDetails;
use Modules\Payroll\Entities\PayrollSetting;
use Yajra\DataTables\Html\Button;
use Yajra\DataTables\Html\Column;

class EmployeeHourlyDataTable extends BaseDataTable
{
    private $type;
    private $numberField;

    public function __construct()
    {
        parent::__construct();
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

            ->addColumn('check', function ($row) {
                return $this->checkBox($row);
            })
            ->editColumn('overtime_hourly_rate', function ($row) {

                $amount = '<input type="text" id="hourly_rate'.$row->user_id.'" name="hourly_rate['.$row->user_id.']" value="'.$row->overtime_hourly_rate.'" class="form-control number_'.$row->user_id.'">';
                $amount .= '<input type="hidden" name="employee_id[]" value="'.$row->user_id.'">';
                return $amount;
            })

            ->editColumn('user_id', function ($row) {
                if($row->user)
                {
                    return view('components.employee', [
                        'user' => $row->user
                    ]);
                }

            })

            ->addIndexColumn()
            ->setRowId(fn($row) => 'row-' . $row->id)
            ->rawColumns(['check', 'overtime_hourly_rate', 'user_id']);
    }

    /**
     * Get query source of dataTable.
     *
     * @param  $model
     * @return \Illuminate\Database\Eloquent\Builder
     */
    //phpcs:ignore
    public function query(EmployeeDetails $model)
    {
        $request = $this->request();

        $compliance = $model->select('employee_details.id', 'employee_details.user_id', 'employee_details.company_id', 'employee_details.overtime_hourly_rate')->with('user')->join('users', 'users.id', 'employee_details.user_id');

        if ($request->user_id != '' && $request->user_id != 'all' && $request->user_id != null ) {
            $compliance = $compliance->where('employee_details.user_id', $request->user_id);
        }

        if ($request->searchText != '') {
            $compliance = $compliance->where(function ($query) {
                $query->where('users.name', 'like', '%' . request('searchText') . '%')
                    ->orWhere('users.email', 'like', '%' . request('searchText') . '%');
            });
        }

        return $compliance;
    }

    /**
     * Optional method if you want to use html builder.
     *
     * @return \Yajra\DataTables\Html\Builder
     */
    public function html()
    {
        return parent::setBuilder('employee-hourly-rate')
            ->parameters([
                'initComplete' => 'function () {
                    window.LaravelDataTables["employee-hourly-rate"].buttons().container()
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
        $payrollSetting = PayrollSetting::first();
        $currency = (!is_null($payrollSetting->currency_id)) ? $payrollSetting->currency : company()->currency;
        $columns = [
            'check' => [
                'title' => '<input type="checkbox" name="select_all_table" id="select-all-table" onclick="selectAllTable(this)">',
                'exportable' => false,
                'orderable' => false,
                'searchable' => false
            ],
            __('app.menu.employees') => ['data' => 'user_id', 'name' => 'user_id', 'title' => __('app.menu.employees')],
            __('payroll::modules.payroll.hourlyRate', [ 'currency' => $currency->currency_symbol]) => ['data' => 'overtime_hourly_rate', 'name' => 'overtime_hourly_rate', 'title' => __('payroll::modules.payroll.hourlyRate', ['currency' => $currency->currency_symbol])]

        ];

        return $columns;
    }

}
