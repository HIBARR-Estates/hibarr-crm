<?php

namespace Modules\QRCode\DataTables;

use App\DataTables\BaseDataTable;
use Illuminate\Support\Carbon;
use Modules\QRCode\Entities\QrCodeData;
use Modules\QRCode\Enums\Format;
use Modules\QRCode\Support\QrCode;
use Yajra\DataTables\Html\Button;
use Yajra\DataTables\Html\Column;

class QRCodeDataTable extends BaseDataTable
{
    private $addPermission;
    private $editPermission;
    private $deletePermission;

    public function __construct()
    {
        parent::__construct();
        $this->addPermission = user()->permission('add_qrcode');
        $this->editPermission = user()->permission('edit_qrcode');
        $this->deletePermission = user()->permission('delete_qrcode');
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

            $action .= '<a href="javascript:;" class="qr-img-lightbox dropdown-item" data-id="' . $row->id . '"><i class="fa fa-eye mr-2"></i>'.__('app.view').'</a>';

            if ($this->editPermission != 'none') {
                $action .= '<a class="dropdown-item" href="' . route('qrcode.edit', [$row->id]) . '">
                    <i class="fa fa-edit mr-2"></i>
                    ' . trans('app.edit') . '
                </a>';
            }

            foreach (Format::cases() as $format) {
                $action .= '<a href="' . route('qrcode.download', [$row->id, $format]) . '" class="dropdown-item"><i class="' . $format->iconClass() . ' mr-2"></i>' . __('app.download') . ' ' . $format->label() . '</a>';
            }

            if ($this->deletePermission != 'none') {
                $action .= '<a class="dropdown-item delete-qr-table-row" href="javascript:;" data-qr-id="' . $row->id . '">
                <i class="fa fa-trash mr-2"></i>
                    ' . trans('app.delete') . '
                </a>';
            }

            $action .= '</div>
                    </div>
                </div>';

            return $action;
        });

        $datatables->addColumn('qr_code', function ($row) {

            $html = ' <a href="javascript:;" class="qr-img-lightbox" data-id="' . $row->id . '">
                <img src="' . QrCode::buildQrCode($row, false)->png()->build()->getDataUri() . '" width="100" height="100" class="img-thumbnail">
            </a>';

            return $html;

        });

        $datatables->editColumn('type', function ($row) {
            return $row->type->badge();
        });


        $datatables->editColumn('title', function ($row) {
            $html = '<h5 class="mb-0 f-13 text-darkest-grey"><a href="javascript:;" class="qr-img-lightbox" data-id="' . $row->id . '">' . $row->title . '</a></h5>';

            return $html;
        });
        $datatables->editColumn(
            'created_at',
            function ($row) {
                return Carbon::parse($row->created_at)->translatedFormat($this->company->date_format);
            }
        );

        $datatables->rawColumns([
            'action',
            'qr_code',
            'title',
            'type',
        ]);

        return $datatables;
    }

    /**
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function query(QrCodeData $model)
    {
        $model = $model->query();

        if ($this->request()->searchText != '') {
            $model->where(function ($query) {
                $query->where('data', 'like', '%' . $this->request()->searchText . '%')
                    ->orWhere('title', 'like', '%' . $this->request()->searchText . '%');
            });
        }

        if ($this->request()->type && $this->request()->type != 'all') {
            $model->where('type', $this->request()->type);
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
        $dataTable = $this->setBuilder('qrcode-table', 0)
            ->parameters([
                'initComplete' => 'function () {
                    window.LaravelDataTables["qrcode-table"].buttons().container()
                    .appendTo( "#table-actions")
                }',
                'fnDrawCallback' => 'function( oSettings ) {
                    $("body").tooltip({
                        selector: \'[data-toggle="tooltip"]\'
                    })
                }',
            ]);

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
            __('app.id') => ['data' => 'id', 'name' => 'id', 'visible' => false, 'title' => __('app.id')],
            __('qrcode::app.menu.qrcode') => ['data' => 'qr_code', 'name' => 'qr_code', 'title' => __('qrcode::app.menu.qrcode'), 'orderable' => false],
            __('qrcode::app.fields.qrTitle') => ['data' => 'title', 'name' => 'title', 'title' => __('qrcode::app.fields.qrTitle')],
            __('qrcode::app.fields.type') => ['data' => 'type', 'name' => 'type', 'title' => __('qrcode::app.fields.type')],
            __('app.createdAt') => ['data' => 'created_at', 'name' => 'created_at', 'title' => __('app.createdAt')],
            Column::computed('action', __('app.action'))
                ->exportable(false)
                ->printable(false)
                ->orderable(false)
                ->searchable(false)
                ->addClass('text-right pr-20'),
        ];

    }

}
