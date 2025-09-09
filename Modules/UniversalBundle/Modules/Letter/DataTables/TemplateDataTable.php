<?php

namespace Modules\Letter\DataTables;

use Carbon\Carbon;
use App\DataTables\BaseDataTable;
use Yajra\DataTables\Html\Column;
use Modules\Webhooks\Entities\WebhooksLog;
use Modules\Letter\Entities\Template;

class TemplateDataTable extends BaseDataTable
{

    private $editPermission;
    private $deletePermission;

    public function __construct()
    {
        parent::__construct();
        $this->editPermission = user()->permission('edit_template');
        $this->deletePermission = user()->permission('delete_template');
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
            $action .= '<a href="' . route('letter.template.show', [$row->id]) . '" class="dropdown-item openRightModal"><i class="fa fa-eye mr-2"></i>' . __('app.view') . '</a>';

            if ($this->editPermission != 'none') {
                $action .= '<a href="' . route('letter.template.edit', [$row->id]) . '" class="dropdown-item openRightModal"><i class="fa fa-edit mr-2"></i>' . __('app.edit') . '</a>';
            }

            if ($this->deletePermission != 'none') {
                $action .= '<a href="javascript:;" data-template-id="' . $row->id . '" class="dropdown-item delete-table-row"><i class="fa fa-trash mr-2"></i>' . __('app.delete') . '</a>';
            }

            $action .= '</div>
                    </div>
                </div>';

            return $action;
        });

        $datatables->addIndexColumn();
        $datatables->editColumn('title', function($row){
            return '<a href="' . route('letter.template.show', [$row->id]) . '" class="text-darkest-grey openRightModal">' . $row->title . '</a>';
        });
        $datatables->smart(false);

        $datatables->setRowId(fn($row) => 'row-' . $row->id);

        $datatables->rawColumns(['name', 'action', 'created_at', 'title']);

        return $datatables;
    }

    /**
     * @param WebhooksLog $model
     * @return \Illuminate\Database\Query\Builder
     */
    public function query(Template $model)
    {
        $model = $model->query();

        if (request()->searchText) {
            $model = $model->where(
                function ($query) {
                    $query->where('title', 'like', '%' . request()->searchText . '%')
                        ->orWhere('description', 'like', '%' . request()->searchText . '%');
                }
            );
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
        return $this->setBuilder('template-table', 2)
            ->parameters([
                'initComplete' => 'function () {
                    window.LaravelDataTables["template-table"].buttons().container()
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
     * Get columns.
     *
     * @return array
     */
    protected function getColumns()
    {
        $data = [
            '#' => ['data' => 'DT_RowIndex', 'orderable' => false, 'searchable' => false, 'title' => '#', 'visible' => false],
            __('app.id') => ['data' => 'id', 'name' => 'id', 'title' => __('app.id'), 'visible' => false],
            __('app.title') => ['data' => 'title', 'name' => 'title', 'title' => __('app.title'), 'exportable' => false,],
            __('app.createdAt') => ['data' => 'created_at', 'name' => 'created_at', 'title' => __('app.createdAt'), 'visible' => false],
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

}
