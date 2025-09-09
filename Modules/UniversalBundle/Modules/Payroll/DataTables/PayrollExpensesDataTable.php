<?php

namespace Modules\Payroll\DataTables;

use App\DataTables\BaseDataTable;
use App\Models\Expense;
use App\Models\CustomField;
use App\Models\CustomFieldGroup;
use Yajra\DataTables\Html\Button;
use Yajra\DataTables\Html\Column;
use Illuminate\Support\Facades\DB;

class PayrollExpensesDataTable extends BaseDataTable
{

    private $viewExpensePermission;
    private $includeSoftDeletedProjects;

    public function __construct($includeSoftDeletedProjects = false)
    {
        parent::__construct();
        $this->viewExpensePermission = user()->permission('view_expenses');
        $this->includeSoftDeletedProjects = $includeSoftDeletedProjects;
    }

    /**
     * Build DataTable class.
     *
     * @param mixed $query Results from query() method.
     * @return \Yajra\DataTables\DataTableAbstract
     */
    public function dataTable($query)
    {

        $datatables = datatables()->eloquent($query);
        $datatables->addIndexColumn();
        $datatables->addColumn('check', fn($row) => $this->checkBox($row));
        $datatables->addColumn('action', function ($row) {

            $action = '<div class="task_view">

                    <div class="dropdown">
                        <a class="task_view_more d-flex align-items-center justify-content-center dropdown-toggle" type="link"
                            id="dropdownMenuLink-' . $row->id . '" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                            <i class="icon-options-vertical icons"></i>
                        </a>
                        <div class="dropdown-menu dropdown-menu-right" aria-labelledby="dropdownMenuLink-' . $row->id . '" tabindex="0">';

            $action .= '<a href="' . route('payroll-expenses.show', [$row->id]) . '" class="dropdown-item"><i class="fa fa-eye mr-2"></i>' . __('app.view') . '</a>';

            $action .= '</div>
                    </div>
                </div>';

            return $action;
        });
        $datatables->editColumn('price', function ($row) {
            return $row->total_amount;
        });
        $datatables->editColumn('item_name', function ($row) {
            if (is_null($row->expenses_recurring_id)) {
                return '<a href="' . route('expenses.show', $row->id) . '" class="openRightModal text-darkest-grey">' . $row->item_name . '</a>';
            }

            return '<a href="' . route('expenses.show', $row->id) . '" class="openRightModal text-darkest-grey">' . $row->item_name . '</a>
                <p class="mb-0"><span class="badge badge-primary"> ' . __('app.recurring') . ' </span></p>';
        });
        $datatables->addColumn('export_item_name', function ($row) {
            return $row->item_name;
        });
        $datatables->addColumn('employee_name', function ($row) {
            return $row->user?->name;
        });
        $datatables->editColumn('user_id', function ($row) {
            return view('components.employee', [
                'user' => $row->user
            ]);
        });
        $datatables->editColumn('status', function ($row) {


            if ($row->status == 'pending') {
                $class = 'text-yellow';
                $status = __('app.pending');

            }
            else if ($row->status == 'approved') {
                $class = 'text-light-green';
                $status = __('app.approved');

            }
            else {
                $class = 'text-red';
                $status = __('app.rejected');
            }

            $status = '<i class="fa fa-circle mr-1 ' . $class . ' f-10"></i> ' . $status;


            return $status;
        });
        $datatables->addColumn('status_export', function ($row) {
            return $row->status;
        });

        $datatables->editColumn(
            'purchase_date',
            function ($row) {
                if (!is_null($row->purchase_date)) {
                    return $row->purchase_date->translatedFormat($this->company->date_format);
                }
            }
        );
        $datatables->editColumn(
            'purchase_from',
            function ($row) {
                return !is_null($row->purchase_from) ? $row->purchase_from : '--';
            }
        );
        $datatables->smart(false);
        $datatables->setRowId(fn($row) => 'row-' . $row->id);
        $datatables->addIndexColumn();
        $datatables->removeColumn('currency_id');
        $datatables->removeColumn('name');
        $datatables->removeColumn('currency_symbol');
        $datatables->removeColumn('updated_at');
        $datatables->removeColumn('created_at');

        // Custom Fields For export
        $customFieldColumns = CustomField::customFieldData($datatables, Expense::CUSTOM_FIELD_MODEL);

        $datatables->rawColumns(array_merge(['action', 'status', 'user_id', 'item_name', 'check'], $customFieldColumns));

        return $datatables;
    }

    /**
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function query()
    {
        $request = $this->request();

        $model = Expense::with('currency', 'user', 'user.employeeDetail', 'user.employeeDetail.designation', 'user.session')
            ->select('expenses.id', 'expenses.project_id', 'expenses.item_name', 'expenses.user_id', 'expenses.price', 'users.salutation', 'users.name', 'expenses.purchase_date', 'expenses.currency_id', 'currencies.currency_symbol', 'expenses.status', 'expenses.purchase_from', 'expenses.expenses_recurring_id', 'designations.name as designation_name', 'expenses.added_by', 'projects.deleted_at as project_deleted_at')
            ->leftjoin('users', 'users.id', 'expenses.user_id')
            ->leftJoin('employee_details', 'employee_details.user_id', '=', 'users.id')
            ->leftJoin('designations', 'employee_details.designation_id', '=', 'designations.id')
            ->whereExists(function ($query) {
                $query->select(DB::raw(1))
                    ->from('salary_slips')
                    ->whereColumn('salary_slips.expense_id', 'expenses.id');
            })
            ->leftJoin('projects', 'projects.id', 'expenses.project_id')
            ->join('currencies', 'currencies.id', 'expenses.currency_id');

        if (!$this->includeSoftDeletedProjects) {
            $model->whereNull('projects.deleted_at');
        }

        if ($request->startDate !== null && $request->startDate != 'null' && $request->startDate != '') {
            $startDate = companyToDateString($request->startDate);
            $model = $model->where(DB::raw('DATE(expenses.`purchase_date`)'), '>=', $startDate);
        }

        if ($request->endDate !== null && $request->endDate != 'null' && $request->endDate != '') {
            $endDate = companyToDateString($request->endDate);
            $model = $model->where(DB::raw('DATE(expenses.`purchase_date`)'), '<=', $endDate);
        }

        if ($request->status != 'all' && !is_null($request->status)) {
            $model = $model->where('expenses.status', '=', $request->status);
        }

        if ($request->employee != 'all' && !is_null($request->employee)) {
            $model = $model->where('expenses.user_id', '=', $request->employee);
        }

        if ($request->projectId != 'all' && !is_null($request->projectId)) {
            $model = $model->where('expenses.project_id', '=', $request->projectId);
        }

        if ($request->categoryId != 'all' && !is_null($request->categoryId)) {
            $model = $model->where('expenses.category_id', '=', $request->categoryId);
        }

        if ($request->recurringID != '') {
            $model = $model->where('expenses.expenses_recurring_id', '=', $request->recurringID);
        }

        if ($request->searchText != '') {
            $model->where(function ($query) {
                $query->where('expenses.item_name', 'like', '%' . request('searchText') . '%')
                    ->orWhere('users.name', 'like', '%' . request('searchText') . '%')
                    ->orWhere('expenses.price', 'like', '%' . request('searchText') . '%')
                    ->orWhere('expenses.purchase_from', 'like', '%' . request('searchText') . '%');
            });
        }

        if ($this->viewExpensePermission == 'added') {
            $model->where('expenses.added_by', user()->id);
        }

        if ($this->viewExpensePermission == 'owned') {
            $model->where('expenses.user_id', user()->id);
        }

        if ($this->viewExpensePermission == 'both') {
            $model->where(function ($query) {
                $query->where('expenses.added_by', user()->id)
                    ->orWhere('expenses.user_id', user()->id);
            });
        }

        return $model->groupBy('expenses.id');
    }

    /**
     * Optional method if you want to use html builder.
     *
     * @return \Yajra\DataTables\Html\Builder
     */
    public function html()
    {
        $dataTable = $this->setBuilder('payroll-expenses-table', 2)
            ->parameters([
                'initComplete' => 'function () {
                    window.LaravelDataTables["payroll-expenses-table"].buttons().container()
                    .appendTo( "#table-actions")
                }',
                'fnDrawCallback' => 'function( oSettings ) {
                    $(".change-expense-status").selectpicker();
                }',
            ]);

        if (canDataTableExport()) {
            $dataTable->buttons(Button::make(['extend' => 'excel', 'text' => '<i class="fa fa-file-export"></i> ' . trans('app.exportExcel')]));
        }

        return $dataTable;
    }

    /**
     * Get columns.
     *
     * @return array
     */
    protected function getColumns()
    {
        $data = [
            '#' => ['data' => 'DT_RowIndex', 'orderable' => false, 'searchable' => false, 'visible' => !showId()],
            __('app.id') => ['data' => 'id', 'name' => 'expenses.id', 'title' => __('app.id'),'visible' => showId()],
            __('modules.expenses.itemName') => ['data' => 'item_name', 'name' => 'item_name', 'exportable' => false, 'title' => __('modules.expenses.itemName')],
            __('app.menu.itemName') => ['data' => 'export_item_name', 'name' => 'export_item_name', 'visible' => false, 'title' => __('modules.expenses.itemName')],
            __('app.price') => ['data' => 'price', 'name' => 'price', 'title' => __('app.price')],
            __('app.menu.employees') => ['data' => 'user_id', 'name' => 'user_id', 'exportable' => false, 'title' => __('app.menu.employees')],
            __('modules.expenses.purchaseFrom') => ['data' => 'purchase_from', 'name' => 'purchase_from', 'title' => __('modules.expenses.purchaseFrom')],
            __('payroll::modules.payroll.expensesCreateDate') => ['data' => 'purchase_date', 'name' => 'purchase_date', 'title' => __('payroll::modules.payroll.expensesCreateDate')],
            __('app.status') => ['data' => 'status', 'name' => 'status', 'exportable' => false, 'title' => __('app.status')],
            __('app.expense') . ' ' . __('app.status') => ['data' => 'status_export', 'name' => 'status', 'visible' => false, 'title' => __('app.expense')]
        ];

        $action = [
            Column::computed('action', __('app.action'))
                ->exportable(false)
                ->printable(false)
                ->orderable(false)
                ->searchable(false)
                ->addClass('text-right pr-20')
        ];

        return array_merge($data, CustomFieldGroup::customFieldsDataMerge(new Expense()), $action);

    }

}
