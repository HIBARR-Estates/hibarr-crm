<?php

namespace App\DataTables;

use App\Models\Notice;
use Illuminate\Support\Facades\DB;
use Yajra\DataTables\Html\Button;
use Yajra\DataTables\Html\Column;
use App\Helper\UserService;
use App\Helper\Common;

class NoticeBoardDataTable extends BaseDataTable
{

    private $viewNoticePermission;
    private $editNoticePermission;
    private $deleteNoticePermission;

    public function __construct()
    {
        parent::__construct();
        $this->editNoticePermission = user()->permission('edit_notice');
        $this->deleteNoticePermission = user()->permission('delete_notice');
        $this->viewNoticePermission = user()->permission('view_notice');
    }

    /**
     * Build DataTable class.
     *
     * @param mixed $query Results from query() method.
     * @return \Yajra\DataTables\DataTableAbstract
     */
    public function dataTable($query)
    {
        $userId = UserService::getUserId();

        return datatables()
            ->eloquent($query)
            ->addColumn('check', fn($row) => $this->checkBox($row))
            ->addColumn('action', function ($row) use ($userId) {

                $action = '<div class="task_view">
                <a href="' . route('notices.show', [$row->id]) . '"
                        class="taskView openRightModal text-darkest-grey f-w-500">' . __('app.view') . '</a>

                    <div class="dropdown">
                        <a class="task_view_more d-flex align-items-center justify-content-center dropdown-toggle" type="link"
                            id="dropdownMenuLink-' . $row->id . '" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                            <i class="icon-options-vertical icons"></i>
                        </a>
                        <div class="dropdown-menu dropdown-menu-right" aria-labelledby="dropdownMenuLink-' . $row->id . '" tabindex="0">';

                if (
                    $this->editNoticePermission == 'all' || ($this->editNoticePermission == 'added' && $userId == $row->added_by) || ($this->editNoticePermission == 'owned' && in_array($row->to, user_roles())) || ($this->editNoticePermission == 'both' && (in_array($row->to, user_roles()) || $row->added_by == $userId))
                ) {
                    $action .= '<a class="dropdown-item openRightModal" href="' . route('notices.edit', [$row->id]) . '">
                                <i class="fa fa-edit mr-2"></i>
                                ' . trans('app.edit') . '
                            </a>';
                }

                if (
                    $this->deleteNoticePermission == 'all' || ($this->deleteNoticePermission == 'added' && $userId == $row->added_by) || ($this->deleteNoticePermission == 'owned' && in_array($row->to, user_roles())) || ($this->deleteNoticePermission == 'both' && (in_array($row->to, user_roles()) || $row->added_by == $userId))
                ) {

                    $action .= '<a class="dropdown-item delete-table-row" href="javascript:;" data-user-id="' . $row->id . '">
                                <i class="fa fa-trash mr-2"></i>
                                ' . trans('app.delete') . '
                            </a>';
                }

                $action .= '</div>
                    </div>
                </div>';

                return $action;
            })
            ->editColumn(
                'heading',
                function ($row) {
                    return ' <a href="' . route('notices.show', $row->id) . '" class="openRightModal text-darkest-grey" >' . $row->heading . '</a>';
                }
            )
            ->editColumn(
                'created_at',
                function ($row) {
                    return $row->created_at->translatedFormat($this->company->date_format);
                }
            )
            ->editColumn(
                'to',
                function ($row) {
                    return __('app.' . $row->to);
                }
            )
            ->addIndexColumn()
            ->smart(false)
            ->setRowId(fn($row) => 'row-' . $row->id)
            ->rawColumns(['action', 'heading', 'check']);
    }

    /***
     * @param Notice $model
     * @return \Illuminate\Database\Query\Builder
     */
    public function query(Notice $model)
    {
        $request = $this->request();
        $model = $model->with('member')->select('id', 'heading', 'to', 'created_at', 'added_by', 'department_id');

        if ($request->startDate !== null && $request->startDate != 'null' && $request->startDate != '') {
            $startDate = companyToDateString($request->startDate);
            $model = $model->where(DB::raw('DATE(notices.`created_at`)'), '>=', $startDate);
        }

        if ($request->endDate !== null && $request->endDate != 'null' && $request->endDate != '') {
            $endDate = companyToDateString($request->endDate);
            $model = $model->where(DB::raw('DATE(notices.`created_at`)'), '<=', $endDate);
        }

        if ($request->searchText != '') {
            $model->where(function ($query) {
                $safeTerm = Common::safeString(request('searchText'));
                $query->where('notices.heading', 'like', '%' . $safeTerm . '%');
            });
        }

        $userId = UserService::getUserId();

        if (in_array('employee', user_roles()) && !in_array('admin', user_roles())) {
            $model->where(function ($query) {
                if ($this->user && $this->user->employeeDetail && $this->user->employeeDetail->department) {
                    $departmentId = $this->user->employeeDetail->department->id;
                    $query->whereNull('department_id');
                    $query->orWhere('department_id', $departmentId);
                }
            });

            if ($this->viewNoticePermission == 'owned') {
                $model->whereHas('noticeEmployees', function ($query) {
                    $query->where('user_id', user()->id);
                });
            }
        }

        if (in_array('client', user_roles())) {
            $model->whereHas('noticeClients', function ($query) use ($userId) {
                $query->where('user_id', $userId);
            });
        }

        if ($this->viewNoticePermission == 'added') {
            $model->where('notices.added_by', $userId);
        }

        if ($this->viewNoticePermission === 'both') {
            $model->where(function ($query) use ($userId) {
                $query->where('notices.added_by', $userId)
                    ->orWhereHas('member', fn($q) => $q->where('user_id', $userId));
            });
        }

        return $model;
    }

    /**
     * Optional method if you want to use html builder.
     *
     * @return \Yajra\DataTables\Html\Builder
     */
    public function html()
    {
        $dataTable = $this->setBuilder('notice-board-table', 3)
            ->parameters([
                'initComplete' => 'function () {
                   window.LaravelDataTables["notice-board-table"].buttons().container()
                    .appendTo("#table-actions")
                }',
                'fnDrawCallback' => 'function( oSettings ) {
                    $("body").tooltip({
                        selector: \'[data-toggle="tooltip"]\'
                    })
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
        return [
            'check' => [
                'title' => '<input type="checkbox" name="select_all_table" id="select-all-table" onclick="selectAllTable(this)">',
                'exportable' => false,
                'orderable' => false,
                'searchable' => false,
                'visible' => !in_array('client', user_roles())
            ],
            '#' => ['data' => 'DT_RowIndex', 'orderable' => false, 'searchable' => false, 'visible' => false, 'title' => '#'],
            __('modules.notices.notice') => ['data' => 'heading', 'name' => 'heading', 'title' => __('modules.notices.notice')],
            __('app.date') => ['data' => 'created_at', 'name' => 'created_at', 'title' => __('app.date')],
            __('app.to') => ['data' => 'to', 'name' => 'to', 'title' => __('app.to'), 'visible' => !in_array('client', user_roles())],
            Column::computed('action', __('app.action'))
                ->exportable(false)
                ->printable(false)
                ->orderable(false)
                ->searchable(false)
                ->addClass('text-right pr-20')
        ];
    }
}
