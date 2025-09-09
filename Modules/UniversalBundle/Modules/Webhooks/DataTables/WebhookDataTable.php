<?php

namespace Modules\Webhooks\DataTables;

use Carbon\Carbon;
use App\DataTables\BaseDataTable;
use Yajra\DataTables\Html\Column;
use Modules\Webhooks\Entities\WebhooksSetting;

class WebhookDataTable extends BaseDataTable
{

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
        $datatables = datatables()->eloquent($query);

        $datatables->addColumn('action', function ($row) {

            $action = '<div class="task_view">

                    <div class="dropdown">
                        <a class="task_view_more d-flex align-items-center justify-content-center dropdown-toggle" type="link"
                            id="dropdownMenuLink-' . $row->id . '" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                            <i class="icon-options-vertical icons"></i>
                        </a>
                        <div class="dropdown-menu dropdown-menu-right" aria-labelledby="dropdownMenuLink-' . $row->id . '" tabindex="0">';

            $action .= '<a class="dropdown-item openRightModal" href="' . route('webhooks.edit', [$row->id]) .'"><i class="fa fa-edit mr-2"></i>' . trans('app.edit') . '</a>';

            $action .= '<a class="dropdown-item delete-table-row" href="javascript:;" data-webhook-id="' . $row->id . '">
                                <i class="fa fa-trash mr-2"></i>
                                ' . trans('app.delete') . '
                            </a>';

            $action .= '</div>
                    </div>
                </div>';

            return $action;
        });

        $datatables->addColumn('name', function ($row) {
            return $row->name;
        });

        $datatables->addColumn('url', function ($row) {
            return $row->url;
        });

        $datatables->editColumn('status', function ($row) {
            $selectOptions = [
                'active' => [
                    'label' => __('app.active'),
                    'class' => 'fa fa-circle mr-2 text-light-green',
                ],
                'inactive' => [
                    'label' => __('app.inactive'),
                    'class' => 'fa fa-circle mr-2 text-red',
                ],
            ];

            $status = '<select class="form-control select-picker quick-action-apply" data-action-type="status"  data-webhook-id="' . $row->id . '">';

            foreach ($selectOptions as $key => $option) {
                $selected = ($row->status == $key) ? 'selected' : '';

                $status .= '<option value="' . $key . '" ' . $selected . ' data-content="<i class=\'' . $option['class'] . '\'></i> ' . $option['label'] . '">' . $option['label'] . '</option>';
            }

            $status .= '</select>';

            return $status;
        });

        // $datatables->editColumn('run_debug', function ($row) {
        //     $selectOptions = [
        //         1 => [
        //             'label' => __('app.yes'),
        //             'class' => 'fa fa-circle mr-2 text-light-green',
        //         ],
        //         0 => [
        //             'label' => __('app.no'),
        //             'class' => 'fa fa-circle mr-2 text-red',
        //         ],
        //     ];

        //     $status = '<select class="form-control select-picker quick-action-apply" data-action-type="debug" data-webhook-id="' . $row->id . '">';

        //     foreach ($selectOptions as $key => $option) {
        //         $selected = ($row->run_debug == $key) ? 'selected' : '';
        //         $status .= '<option value="' . $key . '" ' . $selected . ' data-content="<i class=\'' . $option['class'] . '\'></i> ' . $option['label'] . '">' . $option['label'] . '</option>';
        //     }

        //     $status .= '</select>';

        //     return $status;
        // });


        $datatables->addIndexColumn();
        $datatables->smart(false);

        $datatables->setRowId(fn($row) => 'row-' . $row->id);

        $datatables->rawColumns(['action', 'name', 'url', 'status', 'run_debug']);

        return $datatables;
    }

    /**
     * @param WebhooksSetting $model
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function query(WebhooksSetting $model)
    {
        $request = $this->request();

        $model = $model->select('webhooks_settings.*');

        if ($request->searchText != '') {
            $model->where(function ($query) {
                $query->where('webhooks_settings.name', 'like', '%' . request('searchText') . '%')
                    ->orWhere('webhooks_settings.url', 'like', '%' . request('searchText') . '%');
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
        return $this->setBuilder('webhooks-table', 2)
            ->parameters([
                'initComplete' => 'function () {
                    window.LaravelDataTables["webhooks-table"].buttons().container()
                    .appendTo( "#table-actions")
                }',
                'fnDrawCallback' => 'function( oSettings ) {
                    $("body").tooltip({
                        selector: \'[data-toggle="tooltip"]\'
                    });
                    $(".quick-action-apply").selectpicker();
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
            '#' => ['data' => 'DT_RowIndex', 'orderable' => false, 'searchable' => false, 'visible' => false, 'title' => '#'],
            __('app.id') => ['data' => 'id', 'name' => 'id', 'title' => __('app.id'), 'visible' => showId()],

            __('webhooks::app.webhookName') => ['data' => 'name', 'name' => 'name', 'title' => __('webhooks::app.webhookName'), 'exportable' => false,],

            __('webhooks::app.requestUrl') => ['data' => 'url', 'name' => 'url', 'title' => __('webhooks::app.requestUrl')],

            __('app.status') => ['data' => 'status', 'name' => 'status', 'title' => __('app.status'), 'visible' => true],

            // __('webhooks::app.runDebug') => ['data' => 'run_debug', 'name' => 'run_debug', 'title' => __('webhooks::app.runDebug'), 'visible' => true],
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
