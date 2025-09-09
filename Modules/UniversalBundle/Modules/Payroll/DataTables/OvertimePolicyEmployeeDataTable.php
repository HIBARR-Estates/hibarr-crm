<?php

namespace Modules\Payroll\DataTables;

use App\DataTables\BaseDataTable;
use App\Models\EmployeeDetails;
use Modules\Payroll\Entities\OvertimePolicyEmployee;

class OvertimePolicyEmployeeDataTable extends BaseDataTable
{

    protected $policyEmployeeData;

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
        $this->policyEmployeeData = OvertimePolicyEmployee::with(['policy'])->get()->keyBy('user_id')->toArray();

        return datatables()
            ->eloquent($query)

            ->addColumn('check', function ($row) {
                return $this->checkBoxPolicy($row);
            })

            ->addColumn('overtime_policy', function ($row) {

                if(isset($this->policyEmployeeData[$row->user_id])){
                    return $this->policyEmployeeData[$row->user_id]['policy']['name'].' '.'<a href="javascript:;" class="removePolicy" data-user-id="'.$row->user_id.'">Remove Policy</a>';
                }

                return '--';
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
            ->rawColumns(['check', 'user_id', 'overtime_policy']);
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

        $overtimePolicyEmployee = $model->select('employee_details.id', 'employee_details.user_id', 'employee_details.company_id')
            ->with('user')
            ->join('users', 'users.id', 'employee_details.user_id');

        if ($request->user_id != '' && $request->user_id != 'all' && $request->user_id != null ) {
            $overtimePolicyEmployee = $overtimePolicyEmployee->where('employee_details.user_id', $request->user_id);
        }

        if ($request->searchText != '') {
            $overtimePolicyEmployee = $overtimePolicyEmployee->where(function ($query) {
                $query->where('users.name', 'like', '%' . request('searchText') . '%')
                    ->orWhere('users.email', 'like', '%' . request('searchText') . '%');
            });
        }

        return $overtimePolicyEmployee;
    }

    /**
     * Optional method if you want to use html builder.
     *
     * @return \Yajra\DataTables\Html\Builder
     */
    public function html()
    {
        return parent::setBuilder('overtime-policy-employee')
            ->parameters([
                'initComplete' => 'function () {
                    window.LaravelDataTables["overtime-policy-employee"].buttons().container()
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
        $columns = [
            'check' => [
                'title' => '<input type="checkbox" name="select_all_table" id="select-all-table" onclick="selectAllTable(this)">',
                'exportable' => false,
                'orderable' => false,
                'searchable' => false
            ],
            __('app.menu.employees') => ['data' => 'user_id', 'name' => 'user_id', 'title' => __('app.menu.employees')],
            __('payroll::modules.payroll.overtimePolicy') => ['data' => 'overtime_policy', 'name' => 'overtime_policy', 'title' => __('payroll::modules.payroll.overtimePolicy')]

        ];

        return $columns;
    }

    public function checkBoxPolicy($row,$hidechk = false): string
    {
        if ($hidechk) {
            return '';
        }

        return '<input type="checkbox" class="select-table-row" id="datatable-row-' . $row->user_id . '"  name="datatable_ids[]" value="' . $row->user_id . '" onclick="dataTableRowCheck(' . $row->user_id . ')">';

    }

}
