<?php

namespace Modules\Letter\DataTables;

use Illuminate\Support\Carbon;
use App\DataTables\BaseDataTable;
use Yajra\DataTables\Html\Column;
use Modules\Letter\Entities\Letter;

class LetterDataTable extends BaseDataTable
{
    private $addPermission;
    private $editPermission;
    private $deletePermission;

    public function __construct()
    {
        parent::__construct();
        $this->addPermission = user()->permission('add_letter');
        $this->editPermission = user()->permission('edit_letter');
        $this->deletePermission = user()->permission('delete_letter');
    }

    public function dataTable($query)
    {
        $datatables = datatables()->eloquent($query);
        $datatables->editColumn('created_at', function ($row) {
            return Carbon::parse($row->created_at)->translatedFormat($this->company->date_format);
        });

        $datatables->addColumn('action', function ($row) {
            $action = '<div class="task_view">

                    <div class="dropdown">
                        <a class="task_view_more d-flex align-items-center justify-content-center dropdown-toggle" type="link"
                            id="dropdownMenuLink-' . $row->id . '" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                            <i class="icon-options-vertical icons"></i>
                        </a>
                        <div class="dropdown-menu dropdown-menu-right" aria-labelledby="dropdownMenuLink-' . $row->id . '" tabindex="0">';
            $action .= '<a href="' . route('letter.generate.show', [$row->id]) . '" class="dropdown-item openRightModal"><i class="fa fa-eye mr-2"></i>' . __('app.view') . '</a>';
            $action .= '<a href="' . route('letter.download', $row->id) . '" class="dropdown-item"><i class="fa fa-download mr-2"></i>' . __('app.download') . '</a>';

            if ($this->addPermission != 'none') {
                $action .= '<a href="' . route('letter.generate.create') . '?letterId=' . $row->id . '" class="dropdown-item openRightModal"><i class="fa fa-clone mr-2"></i>' . __('app.duplicate') . '</a>';
            }

            if ($this->editPermission != 'none') {
                $action .= '<a href="' . route('letter.generate.edit', [$row->id]) . '" class="dropdown-item openRightModal"><i class="fa fa-edit mr-2"></i>' . __('app.edit') . '</a>';
            }

            if ($this->deletePermission != 'none') {
                $action .= '<a href="javascript:;" data-letter-id="' . $row->id . '" class="dropdown-item delete-table-row"><i class="fa fa-trash mr-2"></i>' . __('app.delete') . '</a>';
            }

            $action .= '</div>
                    </div>
                </div>';

            return $action;
        })
        ->editColumn('template_id', function($row){
            return '<a href="' . route('letter.generate.show', [$row->id]) . '" class="text-darkest-grey openRightModal">' . $row->template->title . '</a>';
        })
        ->editColumn('user_id', function($row){
            return '<a href="' . route('letter.generate.show', [$row->id]) . '" class="text-darkest-grey openRightModal">' . $row->employee_name . '</a>';
        });

        $datatables->addIndexColumn();
        $datatables->smart(false);

        $datatables->setRowId(fn($row) => 'row-' . $row->id);

        $datatables->rawColumns(['name', 'action', 'created_at', 'user_id', 'template_id']);

        return $datatables;
    }

    /**
     * Get the query source of dataTable.
     */
    public function query()
    {
        $model = Letter::with(['user', 'template']);

        if (request()->searchText) {
            $model = $model->where(
                function ($query) {
                    $query->whereHas('user', function ($q) {
                        $q->where('name', 'like', '%' . request()->searchText . '%');
                    })
                    ->orWhereHas('template', function ($q) {
                            $q->where('title', 'like', '%' . request()->searchText . '%');
                    })
                    ->orWhere('description', 'like', '%' . request()->searchText . '%');
                }
            );
        }

        return $model;
    }

    /**
     * Optional method if you want to use the html builder.
     */
    public function html()
    {
        return $this->setBuilder('letter-table', 2)
            ->parameters([
                'initComplete' => 'function () {
                    window.LaravelDataTables["letter-table"].buttons().container()
                    .appendTo( "#table-actions")
                }',
                'fnDrawCallback' => 'function( oSettings ) {
                    $("body").tooltip({
                        selector: \'[data-toggle="tooltip"]\'
                    });
                }',
            ]);
    }

    /**
     * Get the dataTable columns definition.
     */
    protected function getColumns()
    {
        $data = [
            '#' => ['data' => 'DT_RowIndex', 'orderable' => false, 'searchable' => false, 'visible' => false, 'title' => '#'],
            __('app.id') => ['data' => 'id', 'name' => 'id', 'title' => __('app.id'), 'visible' => false],

            __('app.menu.employees') => ['data' => 'user_id', 'name' => 'user_id', 'title' => __('app.menu.employees')],

            __('letter::app.fields.letterType') => ['data' => 'template_id', 'name' => 'template_id', 'title' => __('letter::app.fields.letterType')],

            __('app.createdAt') => ['data' => 'created_at', 'name' => 'created_at', 'title' => __('app.createdAt')],
        ];

        $action = [
            Column::computed('action', __('app.action'))
                ->exportable(false)
                ->printable(false)
                ->orderable(false)
                ->searchable(false)
                ->addClass('text-right pr-20')
        ];

        return array_merge($data, $action);
    }

    /**
     * Get the filename for export.
     */
    protected function filename(): string
    {
        return 'LetterGenerates_' . date('YmdHis');
    }

}
