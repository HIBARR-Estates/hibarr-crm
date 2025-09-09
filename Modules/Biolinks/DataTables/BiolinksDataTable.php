<?php

namespace Modules\Biolinks\DataTables;

use Yajra\DataTables\Html\Button;
use Yajra\DataTables\Html\Column;
use App\DataTables\BaseDataTable;
use Modules\Biolinks\Entities\Biolink;
use Modules\Biolinks\Enums\Status;

class BiolinksDataTable extends BaseDataTable
{

    private $editBiolinkPermission;
    private $deleteBiolinkPermission;

    public function __construct()
    {
        parent::__construct();
        $this->editBiolinkPermission = user()->permission('edit_biolinks');
        $this->deleteBiolinkPermission = user()->permission('delete_biolinks');
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

        $datatables->addColumn('action', function ($row) {

            $action = '<div class="task_view">

                    <div class="dropdown">
                        <a class="task_view_more d-flex align-items-center justify-content-center dropdown-toggle" type="link"
                            id="dropdownMenuLink-' . $row->id . '" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                            <i class="icon-options-vertical icons"></i>
                        </a>
                        <div class="dropdown-menu dropdown-menu-right" aria-labelledby="dropdownMenuLink-' . $row->id . '" tabindex="0">';

            $action .= '<a target="_blank" href="' . route('biolink.index', $row->page_link) . '" class="dropdown-item"><i class="fa fa-eye mr-2"></i>' . __('app.view') . '</a>';

            if ($this->editBiolinkPermission != 'none') {
                $action .= '<a class="dropdown-item" href="' . route('biolinks.edit', [$row->id]) . '">
                                <i class="fa fa-edit mr-2"></i>' . trans('app.edit') . '
                            </a>';
            }

            if ($this->deleteBiolinkPermission != 'none') {
                $action .= '<a class="dropdown-item delete-table-row" href="javascript:;" data-biolink-id="' . $row->id . '"><i class="fa fa-trash mr-2"></i>' . trans('app.delete') . '</a>';
            }

            $action .= '</div>
                    </div>
                </div>';

            return $action;
        });
        $datatables->editColumn('page_link', fn($row) => '<a target="_blank" href="' . route('biolink.index', $row->page_link) . '" class="text-darkest-grey">' . $row->page_link . '</a>');
        $datatables->addColumn('page_url', fn($row) => route('biolink.index', $row->page_link));
        $datatables->addColumn('total_page_views', fn($row) => $row->total_page_views ?? 0);
        $datatables->addColumn('status', function ($row) {
            $select = '<select class="form-control select-picker change-biolink-status" data-biolink-id="' . $row->id . '">';

            foreach (Status::cases() as $status) {
                $select .= '<option value="' . $status->value . '" data-content="' . $status->html() . '" ' . ($status == $row->status ? 'selected' : '') . '>' . $status->label() . '</option>';
            }

            $select .= '</select>';

            return $select;
        });
        $datatables->addColumn('export-status', fn($row) => $row->status->label() ?? '');
        $datatables->editColumn('created_at', fn($row) => $row->created_at->translatedFormat($this->company->date_format));
        $datatables->smart(false);
        $datatables->setRowId(fn($row) => 'row-' . $row->id);
        $datatables->rawColumns(['page_link', 'status', 'action']);

        return $datatables;
    }

    /**
     * @param Biolink $model
     * @return Biolink|\Illuminate\Database\Eloquent\Builder|\Illuminate\Database\Query\Builder
     */
    public function query(Biolink $model)
    {
        $biolinks = $model->query();

        if (request('searchText') != '') {
            $biolinks = $model->where(function ($query) {
                $query->where('page_link', 'like', '%' . request('searchText') . '%');
            });
        }

        return $biolinks;
    }

    /**
     * Optional method if you want to use html builder.
     *
     * @return \Yajra\DataTables\Html\Builder
     */
    public function html()
    {
        $dataTable = $this->setBuilder('biolinks-table', 2)
            ->parameters(
                [
                    'initComplete' => 'function () {
                        window.LaravelDataTables["biolinks-table"].buttons().container()
                            .appendTo( "#table-actions")
                    }',
                    'fnDrawCallback' => 'function( oSettings ) {
                        $("#biolinks-table .select-picker").selectpicker();

                        $("body").tooltip({
                            selector: \'[data-toggle="tooltip"]\'
                        })
                    }',
                ]
            );

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
            '#' => ['data' => 'DT_RowIndex', 'orderable' => false, 'searchable' => false, 'visible' => false, 'title' => '#'],
            __('app.id') => ['data' => 'id', 'name' => 'id', 'title' => __('app.id'), 'visible' => showId()],
            __('biolinks::app.biolinkPage') => ['data' => 'page_link', 'name' => 'page_link', 'title' => __('biolinks::app.biolinkPage')],
            __('app.url') => ['data' => 'page_url', 'name' => 'page_link', 'title' => __('app.url'), 'visible' => false],
            __('biolinks::app.totalPageViews') => ['data' => 'total_page_views', 'name' => 'total_page_views', 'title' => __('biolinks::app.totalPageViews')],
            __('biolinks::app.createdOn') => ['data' => 'created_at', 'name' => 'created_at', 'title' => __('biolinks::app.createdOn')],
            __('app.status') => ['exportable' => false, 'data' => 'status', 'name' => 'status', 'title' => __('app.status')],
            'export-status' => ['visible' => false, 'data' => 'export-status', 'name' => 'export-status', 'title' => __('biolinks::app.status')],
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
