<?php

namespace Modules\Zoom\DataTables;

use App\DataTables\BaseDataTable;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Zoom\Entities\ZoomMeeting;
use Modules\Zoom\Entities\ZoomSetting;
use Yajra\DataTables\Html\Button;
use Yajra\DataTables\Html\Column;

class MeetingDataTable extends BaseDataTable
{
    public function __construct()
    {
        parent::__construct();
        $this->zoomSetting = ZoomSetting::first();
        $this->editZoomPermission = user()->permission('edit_zoom_meetings');
        $this->deleteZoomPermission = user()->permission('delete_zoom_meetings');
        $this->viewZoomPermission = user()->permission('view_zoom_meetings');
    }

    /**
     * Build DataTable class.
     *
     * @param  mixed  $query Results from query() method.
     * @return \Yajra\DataTables\DataTableAbstract
     */
    public function dataTable($query)
    {

        return datatables()
            ->eloquent($query)
            ->addColumn(
                'check', function ($row) {
                    return '<input type="checkbox" class="select-table-row" id="datatable-row-'.$row->id.'"  name="datatable_ids[]" value="'.$row->id.'" onclick="dataTableRowCheck('.$row->id.')">';
                }
            )
            ->addIndexColumn()
            ->addColumn(
                'action', function ($row) {
                    if ($this->zoomSetting->meeting_app == 'in_app') {
                        $url = route('zoom-meetings.start_meeting', $row->id);
                    } else {
                        $url = $this->user->id == $row->created_by ? $row->start_link : $row->join_link;

                    }

                    $action = '<div class="task_view">

                <div class="dropdown">
                    <a class="task_view_more d-flex align-items-center justify-content-center dropdown-toggle" type="link"
                        id="dropdownMenuLink-'.$row->id.'" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                        <i class="icon-options-vertical icons"></i>
                    </a>
                    <div class="dropdown-menu dropdown-menu-right" aria-labelledby="dropdownMenuLink-'.$row->id.'" tabindex="0">';

                    $action .= '<a href="'.route('zoom-meetings.show', [$row->id]).'" class="dropdown-item openRightModal"><i class="fa fa-eye mr-2"></i>'.__('app.view').'</a>';

                    if ($row->status == 'waiting') {
                        $nowDate = now(company()->timezone)->toDateString();
                        $meetingDate = $row->start_date_time->toDateString();

                        if ((is_null($row->occurrence_id) || $nowDate == $meetingDate)
                            && $row->created_by == $this->user->id
                        ) {
                            $action .= '<a class="dropdown-item" target="_blank" href="'.$url.'">
                            <i class="fa fa-play mr-2"></i>
                            '.trans('zoom::modules.zoommeeting.startUrl').'
                        </a>';

                        } else {
                            $action .= '<a class="dropdown-item" target="_blank" href="'.$url.'">
                            <i class="fa fa-play mr-2"></i>
                            '.trans('zoom::modules.zoommeeting.joinUrl').'
                        </a>';
                        }

                        if ($this->editZoomPermission == 'all' || ($this->editZoomPermission == 'added' && user()->id == $row->added_by)) {
                            $action .= '<a href="javascript:;" class="cancel-meeting dropdown-item" data-meeting-id="'.$row->id.'" >
                            <i class="fa fa-times mr-2"></i> '.__('zoom::modules.zoommeeting.cancelMeeting').'
                        </a>';

                            $action .= '<a class="dropdown-item openRightModal" href="'.route('zoom-meetings.edit', [$row->id]).'">
                            <i class="fa fa-edit mr-2"></i>
                            '.trans('app.edit').'
                        </a>';

                        }

                        if (user()->id == $row->added_by) {
                            $action .= '<a class="dropdown-item btn-copy" href="javascript:;" data-clipboard-text="'.$url.'"><i class="fa fa-copy mr-2"></i>'.trans('zoom::modules.zoommeeting.copyMeetingLink').'</a>';

                        } else {
                            $action .= '<a class="dropdown-item btn-copy" href="javascript:;" data-clipboard-text="'.$url.'"><i class="fa fa-copy mr-2"></i>'.trans('zoom::modules.zoommeeting.copyMeetingLink').'</a>';

                        }

                    }

                    if ($row->status == 'live') {
                        $nowDate = now(company()->timezone)->toDateString();
                        $meetingDate = $row->start_date_time->toDateString();

                        if ($this->editZoomPermission == 'added' && user()->id == $row->added_by) {

                            $action .= '<a href="javascript:;" class="end-meeting dropdown-item" data-meeting-id="'.$row->id.'" >
                            <i class="fa fa-stop mr-2"></i> '.__('zoom::modules.zoommeeting.endMeeting').'
                        </a>';

                        } elseif ((is_null($row->occurrence_id) || $nowDate == $meetingDate)) {
                            $action .= '<a class="dropdown-item" target="_blank" href="'.$url.'">
                            <i class="fa fa-play mr-2"></i>
                            '.trans('zoom::modules.zoommeeting.joinUrl').'
                        </a>';
                        }
                    }

                    if ($row->status != 'live') {
                        if ($this->deleteZoomPermission == 'all' || ($this->deleteZoomPermission == 'added' && user()->id == $row->added_by)) {
                            $action .= '<a class="dropdown-item delete-table-row" href="javascript:;" data-occurrence="'.$row->occurrence_order.'" data-meeting-id="'.$row->id.'">
                            <i class="fa fa-trash mr-2"></i>
                            '.trans('app.delete').'
                        </a>';
                        }
                    }

                    $action .= '</div>
                </div>
            </div>';

                    return $action;
                }
            )
            ->editColumn(
                'meeting_id', function ($row) {

                    $meetingId = $row->meeting_id;

                    if (! is_null($row->occurrence_id)) {
                        $meetingId .= '<br><span class="text-muted">'.__('zoom::modules.zoommeeting.occurrence').' - '.$row->occurrence_order.'</span>';

                    }

                    return $meetingId;

                }
            )->editColumn(
                'meeting_name', function ($row) {

                        return '<h5 class="mb-0 f-13 text-darkest-grey"><a href="'.route('zoom-meetings.show', [$row->id]).'" class="openRightModal">'.($row->meeting_name).'</a></h5>';

                }
            )->editColumn(
                'created_by', function ($row) {
                        return $row->host->name ?? '--';
                }
            )->editColumn(
                'start_date_time', function ($row) {
                        return $row->start_date_time->format(company()->date_format.' '.company()->time_format);
                }
            )->editColumn(
                'end_date_time', function ($row) {
                        return $row->end_date_time->format(company()->date_format.' '.company()->time_format);
                }
            )->editColumn(
                'status', function ($row) {

                    if ($row->status == 'waiting') {
                        $class = 'text-yellow';
                        $status = __('zoom::modules.zoommeeting.waiting');

                    } elseif ($row->status == 'live') {
                        $class = 'text-red Blink';
                        $status = __('zoom::modules.zoommeeting.live');

                    } elseif ($row->status == 'canceled') {
                        $class = 'text-danger';
                        $status = __('app.canceled');

                    } elseif ($row->status == 'finished') {
                        $class = 'text-light-green';
                        $status = __('app.finished');

                    } else {
                        $class = '';
                        $status = '';
                    }

                    return '<i class="fa fa-circle mr-1 '.$class.'"></i> '.$status;
                }
            )
            ->setRowId(
                function ($row) {
                    return 'row-'.$row->id;
                }
            )
            ->rawColumns(['action', 'status', 'meeting_name', 'meeting_id', 'check']);
    }

    /**
     * Get query source of dataTable.
     *
     * @param  \App\Product  $model
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function query(ZoomMeeting $model)
    {
        $request = $this->request();

        $startDate = null;
        $endDate = null;

        if ($request->startDate !== null && $request->startDate != 'null' && $request->startDate != '') {
            $startDate = Carbon::createFromFormat(company()->date_format, $request->startDate)->toDateString();
        }

        if ($request->endDate !== null && $request->endDate != 'null' && $request->endDate != '') {
            $endDate = Carbon::createFromFormat(company()->date_format, $request->endDate)->toDateString();
        }

        $model = $model->select(
            'id',
            'meeting_id',
            'created_by',
            'meeting_name',
            'start_date_time',
            'end_date_time',
            'start_link',
            'join_link',
            'status',
            'label_color',
            'occurrence_id',
            'source_meeting_id',
            'occurrence_order',
            'occurrence_order'
        )->with('host');

        if ($startDate !== null && $endDate !== null) {
            $model->where(
                function ($q) use ($startDate, $endDate) {
                    $q->whereBetween(DB::raw('DATE(zoom_meetings.`start_date_time`)'), [$startDate, $endDate]);

                    $q->orWhereBetween(DB::raw('DATE(zoom_meetings.`end_date_time`)'), [$startDate, $endDate]);
                }
            );
        }

        if (request()->has('status') && $request->status != 'all') {
            if ($request->status == 'not finished') {
                $model->where('status', '<>', 'finished');

            } else {
                $model->where('status', $request->status);
            }
        }

        if (request()->has('employee') && $request->employee != 0 && $request->employee != 'all') {
            $model->whereHas(
                'attendees', function ($query) use ($request) {
                    return $query->where('user_id', $request->employee);
                }
            );
        }

        if (request()->has('client') && $request->client != 0 && $request->client != 'all') {
            $model->whereHas(
                'attendees', function ($query) use ($request) {
                    return $query->where('user_id', $request->client);
                }
            );
        }

        if (request()->has('category') && $request->category != 0 && $request->category != 'all') {
            $model->whereHas(
                'category', function ($query) use ($request) {
                    return $query->where('id', $request->category);
                }
            );
        }

        if (request()->has('project') && $request->project != 0 && $request->project != 'all') {
            $model->whereHas(
                'project', function ($query) use ($request) {
                    return $query->where('id', $request->project);
                }
            );
        }

        if ($this->viewZoomPermission == 'added') {
            $model->where('added_by', user()->id);
        }

        if ($this->viewZoomPermission == 'owned') {
            $model->where(
                function ($query) {
                    $query->where('created_by', user()->id);
                    $query->orWhereHas(
                        'attendees', function ($query1) {
                            return $query1->where('user_id', user()->id);
                        }
                    );
                }
            );
        }

        if ($this->viewZoomPermission == 'both') {
            $model->where(
                function ($query) {
                    $query->where('added_by', user()->id);
                    $query->orWhere('created_by', user()->id);
                    $query->orWhereHas(
                        'attendees', function ($query1) {
                            return $query1->where('user_id', user()->id);
                        }
                    );
                }
            );

        }

        if ($request->searchText != '') {
            $model->where(
                function ($query) {
                    $query->where('zoom_meetings.meeting_name', 'like', '%'.request('searchText').'%');
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
        return parent::setBuilder('meeting-table')
            ->buttons(Button::make(['extend' => 'excel', 'text' => '<i class="fa fa-file-export"></i> '.trans('app.exportExcel')]))
            ->parameters(
                [
                    'initComplete' => 'function () {
                    window.LaravelDataTables["meeting-table"].buttons().container()
                    .appendTo("#table-actions")
                }',
                    'fnDrawCallback' => 'function( oSettings ) {
                    $("#allTasks-table .select-picker").selectpicker();
                }',
                ]
            );
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
            ],
            '#' => ['data' => 'id', 'name' => 'id', 'visible' => false],
            __('zoom::modules.meetings.meetingId') => ['data' => 'meeting_id', 'name' => 'meeting_id', 'title' => __('zoom::modules.meetings.meetingId')],
            __('zoom::modules.meetings.meetingName') => ['data' => 'meeting_name', 'name' => 'meeting_name', 'title' => __('zoom::modules.meetings.meetingName')],
            __('zoom::modules.zoommeeting.meetingHost') => ['data' => 'created_by', 'name' => 'created_by', 'title' => __('zoom::modules.zoommeeting.meetingHost')],
            __('zoom::modules.meetings.startOn') => ['data' => 'start_date_time', 'name' => 'start_date_time', 'title' => __('zoom::modules.meetings.startOn')],
            __('zoom::modules.meetings.endOn') => ['data' => 'end_date_time', 'name' => 'end_date_time', 'title' => __('zoom::modules.meetings.endOn')],
            __('app.status') => ['data' => 'status', 'name' => 'status', 'title' => __('app.status')],
            Column::computed('action', __('app.action'))
                ->exportable(false)
                ->printable(false)
                ->orderable(false)
                ->searchable(false)
                ->addClass('text-right pr-20'),
        ];
    }
}
