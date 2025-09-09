<?php

namespace Modules\Webhooks\DataTables;

use Carbon\Carbon;
use App\DataTables\BaseDataTable;
use Yajra\DataTables\Html\Column;
use Modules\Webhooks\Entities\WebhooksLog;

class WebhookLogsDataTable extends BaseDataTable
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

        $datatables->addColumn('name', function ($row) {
            return $row->webhookSettings ? '<a href="' . route('webhooks-log.show', [$row->id]) . '" class="text-darkest-grey">' . $row->webhookSettings->name . '</a>' : '--';
        });

        $datatables->addColumn('response_code', function ($row) {
            $responseCodes = [
                200 => ['class' => 'badge-success', 'label' => 'Success'],
                404 => ['class' => 'badge-warning', 'label' => 'Not Found'],
                500 => ['class' => 'badge-danger', 'label' => 'Internal Server Error'],
                // Add more response codes and their corresponding labels and classes as needed
            ];

            if (isset($responseCodes[$row->response_code])) {
                $badge = $responseCodes[$row->response_code];

                return '<span class="badge ' . $badge['class'] . '">' . $row->response_code . '</span>';
            }

            return '<span class="badge badge-secondary">' . $row->response_code . '</span>'; // Default badge for unknown response codes
        });

        $datatables->editColumn('created_at', function ($row) {
            return Carbon::parse($row->created_at)->translatedFormat($this->company->date_format);
        });

        $datatables->addColumn('action', function ($row) {
            return $row->webhookSettings ? '<div class="task_view"> <a href="' . route('webhooks-log.show', [$row->id]) . '" class="task_view_more d-flex align-items-center justify-content-center edit-custom-field" href="javascript:;" data-id="{{ $row->id }}" >' . __('app.view') . '</a> </div>' : '--';
        });

        $datatables->addIndexColumn();
        $datatables->smart(false);

        $datatables->setRowId(fn($row) => 'row-' . $row->id);

        $datatables->rawColumns(['name', 'action', 'response_code', 'created_at']);

        return $datatables;
    }

    /**
     * @param WebhooksLog $model
     * @return \Illuminate\Database\Query\Builder
     */
    public function query(WebhooksLog $model)
    {
        $request = $this->request();


        $model = $model->select('*','webhooks_logs.id as id')->join('webhooks_settings', 'webhooks_settings.id', '=', 'webhooks_logs.webhooks_setting_id');

        if ($request->searchText != '') {
            $model->where(function ($query) {
                $query->where('webhooks_settings.name', 'like', '%' . request('searchText') . '%')
                    ->orWhere('webhooks_logs.response_code', 'like', '%' . request('searchText') . '%');
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
        return $this->setBuilder('webhooks-log-table', 3)
            ->parameters([
                'initComplete' => 'function () {
                    window.LaravelDataTables["webhooks-log-table"].buttons().container()
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
            '#' => ['data' => 'DT_RowIndex', 'orderable' => false, 'searchable' => false, 'visible' => true, 'title' => '#'],

            __('app.id') => ['data' => 'id', 'name' => 'id', 'title' => __('app.id'), 'visible' => false],

            __('webhooks::app.webhookName') => ['data' => 'name', 'name' => 'name', 'title' => __('webhooks::app.webhookName'), 'exportable' => false,],

            __('webhooks::app.responseCode') => ['data' => 'response_code', 'name' => 'response_code', 'title' => __('webhooks::app.responseCode')],

            __('webhooks::app.createdAt') => ['data' => 'created_at', 'name' => 'created_at', 'title' => __('webhooks::app.createdAt'), 'visible' => false],
        ];

        $action = [
            Column::computed('action', __('app.action'))
                ->exportable(false)
                ->printable(false)
                ->orderable(false)
                ->addClass('text-right pr-20')
        ];

        return array_merge($data, $action);
    }

}
