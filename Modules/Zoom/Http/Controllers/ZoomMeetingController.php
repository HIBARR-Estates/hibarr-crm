<?php

namespace Modules\Zoom\Http\Controllers;

use App\Helper\Reply;
use App\Http\Controllers\AccountBaseController;
use App\Models\Project;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use MacsiDigital\Zoom\Facades\Zoom;
use Modules\Zoom\DataTables\MeetingDataTable;
use Modules\Zoom\Entities\ZoomCategory;
use Modules\Zoom\Entities\ZoomMeeting;
use Modules\Zoom\Entities\ZoomSetting;
use Modules\Zoom\Events\MeetingHostEvent;
use Modules\Zoom\Events\MeetingHostUpdateEvent;
use Modules\Zoom\Events\MeetingInviteEvent;
use Modules\Zoom\Events\MeetingUpdateEvent;
use Modules\Zoom\Http\Requests\ZoomMeeting\StoreMeeting;
use Modules\Zoom\Http\Requests\ZoomMeeting\UpdateMeeting;
use Modules\Zoom\Http\Requests\ZoomMeeting\UpdateOccurrence;
use Modules\Zoom\Traits\ZoomSettingsTrait;

class ZoomMeetingController extends AccountBaseController
{

    use ZoomSettingsTrait;

    public function __construct()
    {
        parent::__construct();
        $this->pageTitle = __('zoom::app.menu.zoomMeeting');

        $this->middleware(
            function ($request, $next) {

                abort_403(!in_array(ZoomSetting::MODULE_NAME, $this->user->modules));
                $this->setZoomConfigs();

                return $next($request);
            }
        );
    }

    /**
     * Display a listing of the resource.
     *
     * @return Response
     */
    public function index(MeetingDataTable $dataTable)
    {
        $viewPermission = user()->permission('view_zoom_meetings');

        abort_403(!in_array($viewPermission, ['all', 'added', 'owned', 'both']));

        if (!request()->ajax()) {
            $this->employees = User::allEmployees(null, true, ($viewPermission == 'all' ? 'all' : null));
            $this->clients = User::allClients();
            $this->events = ZoomMeeting::all();
            $this->categories = ZoomCategory::all();
            $this->projects = Project::allProjects();
        }

        return $dataTable->render('zoom::meeting.index', $this->data);
    }

    /**
     * Show the form for creating a new resource.
     *
     * @return Response
     */
    public function create()
    {
        $this->pageTitle = __('zoom::modules.zoommeeting.addMeeting');

        $this->addPermission = user()->permission('add_zoom_meetings');

        abort_403(!in_array($this->addPermission, ['all', 'added']));

        $this->employees = User::allEmployees(null, true, (($this->addPermission == 'all' || $this->addPermission == 'added') ? 'all' : null));
        $this->clients = User::allClients(($this->addPermission == 'all' ? 'all' : null));
        $this->categories = ZoomCategory::all();
        $this->projects = Project::allProjects();
        $this->zoomSetting = ZoomSetting::first();

        if (user()->roles[0]->name == 'client') {

            $this->clients = User::where('id', user()->id)->get();
        }

        if (request()->ajax()) {

            $html = view('zoom::meeting.ajax.create', $this->data)->render();

            return Reply::dataOnly(['status' => 'success', 'html' => $html, 'title' => $this->pageTitle]);
        }

        $this->view = 'zoom::meeting.ajax.create';

        return view('zoom::meeting.create', $this->data);
    }

    /**
     * Store a newly created resource in storage.
     *
     * @param Request $request
     * @return Response
     */
    public function store(StoreMeeting $request)
    {
        $this->createOrUpdateMeetings($request, null);

        return Reply::successWithData(__('messages.recordSaved'), ['redirectUrl' => route('zoom-meetings.index')]);
    }

    /**
     * Show the specified resource.
     *
     * @param int $id
     * @return Response
     */
    public function show($id)
    {
        $this->event = ZoomMeeting::with('attendees', 'host', 'notes')->findOrFail($id);
        $this->viewPermission = user()->permission('view_zoom_meetings');
        $attendeesIds = $this->event->attendees->pluck('id')->toArray();
        abort_403(
            !(
                $this->viewPermission == 'all'
                || ($this->viewPermission == 'added' && $this->event->added_by == user()->id)
                || ($this->viewPermission == 'owned' && (in_array(user()->id, $attendeesIds || $this->event->created_by == user()->id)))
                || ($this->viewPermission == 'both' && (in_array(user()->id, $attendeesIds) || $this->event->added_by == user()->id || $this->event->created_by == user()->id))
            )
        );

        $this->zoomSetting = ZoomSetting::first();
        $tab = request('view');

        switch ($tab) {

        case 'notes':
            $this->tab = 'zoom::meeting.ajax.notes';
            break;

        default:
            $this->tab = 'zoom::meeting.ajax.notes';
            break;
        }

        if (request()->ajax()) {
            $view = (request('json') == true) ? $this->tab : 'zoom::meeting.ajax.show';
            $html = view($view, $this->data)->render();

            return Reply::dataOnly(['status' => 'success', 'html' => $html, 'title' => $this->pageTitle]);
        }

        $this->view = 'zoom::meeting.ajax.show';

        return view('zoom::meeting.create', $this->data);
    }

    /**
     * Show the form for editing the specified resource.
     *
     * @param int $id
     * @return Response
     */
    public function edit($id)
    {
        $editPermission = user()->permission('edit_zoom_meetings');

        $this->event = ZoomMeeting::with('attendees')->findOrFail($id);
        $eventUsers = $this->event->attendees->pluck('id')->toArray();

        abort_403(
            !(
                $editPermission == 'all'
                || ($editPermission == 'added' && user()->id == $this->event->added_by)
                || ($editPermission == 'owned' && (in_array(user()->id, $eventUsers) || $this->event->created_by == user()->id))
                || ($editPermission == 'both' && (user()->id == $this->event->added_by || in_array(user()->id, $eventUsers) || $this->event->created_by == user()->id))
            )
        );

        $this->employees = User::allEmployees(null, true, ($editPermission == 'all' ? 'all' : null));
        $this->clients = User::allClients();
        $this->categories = ZoomCategory::all();
        $this->projects = Project::allProjects();

        if (!is_null($this->event->occurrence_id)) {
            if (request()->ajax()) {
                $html = view('zoom::meeting.ajax.edit_occurrence', $this->data)->render();

                return Reply::dataOnly(['status' => 'success', 'html' => $html, 'title' => $this->pageTitle]);
            }

            $this->view = 'zoom::meeting.ajax.edit_occurrence';

        }
        else {
            if (request()->ajax()) {
                $html = view('zoom::meeting.ajax.edit', $this->data)->render();

                return Reply::dataOnly(['status' => 'success', 'html' => $html, 'title' => $this->pageTitle]);
            }

            $this->view = 'zoom::meeting.ajax.edit';
        }

        return view('zoom::meeting.create', $this->data);
    }

    /**
     * Update the specified resource in storage.
     *
     * @param Request $request
     * @param int $id
     * @return Response
     */
    public function update(UpdateMeeting $request, $id)
    {

        $this->createOrUpdateMeetings($request, $id);

        return Reply::successWithData(__('messages.updateSuccess'), ['redirectUrl' => route('zoom-meetings.index')]);
    }

    /**
     * Remove the specified resource from storage.
     *
     * @param int $id
     * @return Response
     */
    public function destroy($id)
    {
        $meeting = ZoomMeeting::findOrFail($id);

        // destroy meeting via zoom api
        if (!is_null($meeting->occurrence_id)) {
            $zoomMeeting = Zoom::meeting()->find($meeting->meeting_id);

            if (request()->has('recurring') && request('recurring') == 'yes') {
                // Delete all occurrences
                $zoomMeeting->occurrences()->delete();

            }
            else {
                // Delete single occurrence
                $occurrence = $zoomMeeting->occurrences()->find($meeting->occurrence_id);
                $occurrence->delete();
            }
        }
        else {
            $zoomMeeting = Zoom::user()->find('me')->meetings()->find($meeting->meeting_id);

            if ($zoomMeeting) {
                $zoomMeeting->delete();
            }
        }

        $meeting->attendees()->detach();
        $meeting->delete();

        return Reply::success(__('messages.deleteSuccess'));
    }

    // phpcs:ignore
    public function createMeeting($user, ZoomMeeting $meeting, $id, $meetingId = null, $host = null)
    {

        // create meeting using zoom API
        $commonSettings = [
            'type' => 2,
            'topic' => $meeting->meeting_name,
            'start_time' => $meeting->start_date_time,
            'duration' => $meeting->end_date_time->diffInMinutes($meeting->start_date_time),
            'timezone' => company()->timezone,
            'agenda' => $meeting->description,
            'alternative_host' => [],
            'settings' => [
                'host_video' => $meeting->host_video == 1,
                'participant_video' => $meeting->participant_video == 1,
            ],
        ];

        if ($host) {
            $commonSettings['alternative_host'] = [$host->email];
        }

        if (is_null($id)) {

            $zoomMeeting = $user->meetings()->make($commonSettings);
            $savedMeeting = $user->meetings()->save($zoomMeeting);
            $meeting->meeting_id = $savedMeeting->pmi ?? $savedMeeting->id;
            $meeting->start_link = $savedMeeting->start_url;
            $meeting->join_link = $savedMeeting->join_url;
            $meeting->password = $savedMeeting->password;
            $meeting->save();

        }
        else {

            $user->meetings()->find($meeting->meeting_id)->update($commonSettings);

        }

        return $meeting;
    }

    public function createOrUpdateMeetings($request, $id)
    {

        $host = User::find($request->create_by);
        $user = Zoom::user()->find('me');
        $host_user = User::find($request->created_by);

        if ($request->has('repeat') && $request->repeat) {
            $this->createRepeatMeeting($user, $request, $id);

        }
        else {
            $startDate = Carbon::createFromFormat(company()->date_format . ' ' . company()->time_format, $request->start_date . ' ' . $request->start_time);
            $endDate = Carbon::createFromFormat(company()->date_format . ' ' . company()->time_format, $request->end_date . ' ' . $request->end_time);

            $meeting = is_null($id) ? new ZoomMeeting : ZoomMeeting::find($id);
            $data = $request->all();

            if (!$request->has('send_reminder')) {

                $data['send_reminder'] = 0;
                $data['remind_time'] = 1;
                $data['remind_type'] = 'day';

            }

            $data['meeting_name'] = $request->meeting_title;
            $data['start_date_time'] = $startDate->toDateTimeString();

            $data['end_date_time'] = $endDate->toDateTimeString();
            $data['repeat'] = 0;

            if (is_null($id)) {
                $meeting = $meeting->create($data);
                $this->syncAttendees($request, $meeting, 'yes');
                $this->createMeeting($user, $meeting, $id, $host);
                $meetingUsers = $meeting->attendees->filter(
                    function ($value, $key) use ($host_user) {
                        return $value->id != $host_user->id;
                    }
                );
                event(new MeetingInviteEvent($meeting, $meetingUsers));

                event(new MeetingHostEvent($meeting, $host_user));

            }
            else {
                $meeting->update($data);
                $this->syncAttendees($request, $meeting);

                $meetingUsers = $meeting->attendees->filter(
                    function ($value, $key) use ($host_user) {
                        return $value->id != $host_user->id;
                    }
                );
                event(new MeetingUpdateEvent($meeting, $meetingUsers));
                event(new MeetingHostUpdateEvent($meeting, $host_user));

            }

        }

    }

    public function syncAttendees($request, $meeting)
    {
        $employees = $request->has('employee_id') ? $request->employee_id : [];
        $clients = $request->has('client_id') ? $request->client_id : [];
        $attendees = array_merge($employees, $clients);

        $meeting->attendees()->sync($attendees);

    }

    /**
     * start zoom meeting in app
     *
     * @return \Illuminate\Http\Response
     */
    public function startMeeting($id)
    {
        $this->zoomSetting = ZoomSetting::first();
        $this->meeting = ZoomMeeting::findOrFail($id);
        $this->zoomMeeting = Zoom::meeting()->find($this->meeting->meeting_id);

        return view('zoom::meeting.start_meeting', $this->data);
    }

    /**
     * cancel meeting
     *
     * @return \Illuminate\Http\Response
     */
    public function cancelMeeting()
    {
        $id = request('id');
        ZoomMeeting::where('id', $id)->update(['status' => 'canceled']);

        return Reply::success(__('messages.updateSuccess'));
    }

    /**
     * end meeting
     *
     * @return \Illuminate\Http\Response
     */
    public function endMeeting()
    {
        $id = request('id');
        $meeting = ZoomMeeting::findOrFail($id);

        $zoomMeeting = Zoom::meeting()->find($meeting->meeting_id);

        if ($zoomMeeting) {

            $zoomMeeting->endMeeting();
        }

        $meeting->status = 'finished';
        $meeting->save();

        return Reply::success(__('messages.updateSuccess'));
    }

    /**
     * create repeated meeting
     *
     * @return \Illuminate\Http\Response
     */
    //phpcs:ignore

    public function createRepeatMeeting($user, $request, $id)
    {
        $host_user = User::find($request->created_by);

        $startDate = Carbon::createFromFormat(company()->date_format . ' ' . company()->time_format, $request->start_date . ' ' . $request->start_time);
        $endDate = Carbon::createFromFormat(company()->date_format . ' ' . company()->time_format, $request->end_date . ' ' . $request->end_time);

        $meeting = is_null($id) ? new ZoomMeeting : ZoomMeeting::findOrFail($id);
        $data = $request->all();
        $data['meeting_name'] = $request->meeting_title;
        $data['start_date_time'] = $startDate->toDateTimeString();
        $data['end_date_time'] = $endDate->toDateTimeString();

        if (is_null($id)) {

            $meeting = $meeting->create($data);

        }
        else {

            $meeting->update($data);
        }

        $meeting->source_meeting_id = $meeting->id;
        $meeting->occurrence_order = 1;
        $meeting->save();

        $this->syncAttendees($request, $meeting, 'yes');

        // Create meeting on zoom

        $zoomMeeting = Zoom::meeting()->make(
            [
                'topic' => $request->meeting_title,
                'type' => 8,
                'start_time' => $startDate, // best to use a Carbon instance here.
                'duration' => $meeting->end_date_time->diffInMinutes($meeting->start_date_time),
                'agenda' => $request->description,
                'settings' => [
                    'host_video' => $request->host_video == 1,
                    'participant_video' => $request->participant_video == 1,
                ],
            ]
        );

        if ($request->repeat_type == 'day') {

            $repeatType = 1;

        }
        elseif ($request->repeat_type == 'week') {

            $repeatType = 2;

        }
        else {

            $repeatType = 3;
        }

        $repeatData = $this->createRepeatData($repeatType, $request);
        $zoomMeeting->recurrence()->make($repeatData);
        $savedMeeting = $user->meetings()->save($zoomMeeting);

        // Save zoom response data
        $meeting->repeat_every = $repeatData['repeat_interval'] ?? '';
        $meeting->end_date_time = $repeatData['end_date_time'] ?? '';
        $meeting->repeat_type = $request->repeat_type;
        $meeting->repeat_every = $request->repeat_every_daily;
        $meeting->meeting_id = $savedMeeting->pmi ?? $savedMeeting->id;
        $meeting->start_link = $savedMeeting->start_url;
        $meeting->join_link = $savedMeeting->join_url;
        $meeting->password = $savedMeeting->password;
        $meeting->save();
        event(new MeetingInviteEvent($meeting, $meeting->attendees));

        if ($host_user != null) {
            event(new MeetingHostEvent($meeting, $host_user));
        }
    }

    /**
     * update meeting occurrence
     *
     * @return \Illuminate\Http\Response
     */
    public function updateOccurrence(UpdateOccurrence $request, $id)
    {
        $startDate = Carbon::createFromFormat(company()->date_format . ' ' . company()->time_format, $request->start_date . ' ' . $request->start_time);
        $endDate = Carbon::createFromFormat(company()->date_format . ' ' . company()->time_format, $request->end_date . ' ' . $request->end_time);

        $zoomMeeting = ZoomMeeting::find($id);
        $data = $request->all();
        $data['start_date_time'] = $startDate->toDateTimeString();
        $data['end_date_time'] = $endDate->toDateTimeString();
        $zoomMeeting->update($data);

        $meeting = Zoom::meeting()->find($zoomMeeting->meeting_id);
        $occurrence = $meeting->occurrences()->find($zoomMeeting->occurrence_id);
        $occurrence->start_time = $startDate;
        $occurrence->duration = $endDate->diffInMinutes($endDate);
        $occurrence->save();

        return Reply::successWithData(__('messages.updateSuccess'), ['redirectUrl' => route('zoom-meetings.index')]);
    }

    public function createRepeatData($repeatType, $request)
    {
        $repeatData = [
            'type' => $repeatType,
            'repeat_interval' => intval($request->repeat_every_daily),
        ];

        if ($request->recurrence_end_date == 'date') {

            $repeatData['end_date_time'] = Carbon::createFromFormat(company()->date_format, $request->recurrence_end_date_date);

        }
        else {

            $repeatData['end_times'] = $request->recurrence_end_date_after;
        }

        switch ($repeatType) {

        case '2':

            $repeatData['repeat_interval'] = $request->repeat_every_weekly;
            $repeatData['weekly_days'] = implode(',', $request->occurs_on);
            break;

        case '3':
            $repeatData['repeat_interval'] = $request->repeat_every_monthly;

            if ($request->occurs_on_monthly == 'when') {

                $repeatData['monthly_week'] = $request->occurs_month_when;
                $repeatData['monthly_week_day'] = $request->occurs_month_weekday;

            }
            else {

                $repeatData['monthly_day'] = $request->occurs_month_day;

            }

            break;

        default:
            $repeatData['repeat_interval'] = $request->repeat_every_daily;
            break;
        }

        return $repeatData;
    }

    public function applyQuickAction(Request $request)
    {
        switch ($request->action_type) {
        case 'delete':
            $this->deleteRecords($request);

            return Reply::success(__('messages.deleteSuccess'));
        case 'change-status':
            $this->changeBulkStatus($request);

            return Reply::success(__('messages.updateSuccess'));
        default:
            return Reply::error(__('messages.selectAction'));
        }
    }

    protected function deleteRecords($request)
    {

        ZoomMeeting::whereIn('id', explode(',', $request->row_ids))->delete();
    }

    protected function changeBulkStatus($request)
    {
        abort_403(user()->permission('edit_tasks') != 'all');

        ZoomMeeting::whereIn('id', explode(',', $request->row_ids))->update(['status' => 'canceled']);
    }

    /**
     * XXXXXXXXXXX
     *
     * @return \Illuminate\Http\Response
     */
    public function calendar(Request $request)
    {
        $viewPermission = user()->permission('view_zoom_meetings');
        abort_403(!in_array($viewPermission, ['all', 'added', 'owned', 'both']));

        if (!request()->ajax()) {
            $this->employees = User::allEmployees();
            $this->clients = User::allClients();
            $this->events = ZoomMeeting::all();
            $this->categories = ZoomCategory::all();
            $this->projects = Project::allProjects();
        }

        if (request('start') && request('end')) {
            $meetingsArray = [];
            $startDate = Carbon::parse(request('start'))->format('Y-m-d');
            $endDate = Carbon::parse(request('end'))->format('Y-m-d');

            $meetings = ZoomMeeting::select(
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
                'occurrence_order'
            );

            if (!is_null($request->start)) {

                $meetings->whereRaw('DATE(zoom_meetings.`start_date_time`) >= ?', [$startDate]);
            }

            if (!is_null($request->end)) {

                $meetings->whereRaw('DATE(zoom_meetings.`end_date_time`) <= ?', [$endDate]);
            }

            if (request()->has('status') && $request->status != 'all') {
                if ($request->status == 'not finished') {

                    $meetings->where('status', '<>', 'finished');

                }
                else {

                    $meetings->where('status', $request->status);

                }
            }

            if (request()->has('employee') && $request->employee != 0 && $request->employee != 'all') {
                $meetings->whereHas(
                    'attendees', function ($query) use ($request) {

                    return $query->where('user_id', $request->employee);

                }
                );
            }

            if (request()->has('client') && $request->client != 0 && $request->client != 'all') {

                $meetings->whereHas(
                    'attendees', function ($query) use ($request) {
                    return $query->where('user_id', $request->client);
                }
                );
            }

            if (request()->has('category') && $request->category != 0 && $request->category != 'all') {

                $meetings->whereHas(
                    'category', function ($query) use ($request) {
                    return $query->where('id', $request->category);
                }
                );
            }

            if (request()->has('project') && $request->project != 0 && $request->project != 'undefined') {
                $meetings->whereHas(
                    'project', function ($query) use ($request) {
                    return $query->where('id', $request->project);
                }
                );
            }

            if ($request->searchText != '') {

                $meetings->where(
                    function ($query) {
                        $query->where('zoom_meetings.meeting_name', 'like', '%' . request('searchText') . '%');
                    }
                );
                $meetings->where(
                    function ($query) {

                        $query->where('zoom_meetings.meeting_name', 'like', '%' . request('searchText') . '%');

                    }
                );
            }

            $meetings = $meetings->get();

            foreach ($meetings as $key => $meeting) {

                $meetingsArray[] = [
                    'id' => $meeting->id,
                    'start' => $meeting->start_date_time,
                    'end' => $meeting->end_date_time,
                    'title' => ($meeting->meeting_name),
                    'color' => $meeting->label_color,
                ];
            }

            return $meetingsArray;
        }

        return view('zoom::meeting.calendar', $this->data);

    }

}
