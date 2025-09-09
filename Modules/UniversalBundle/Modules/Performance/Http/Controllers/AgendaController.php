<?php

namespace Modules\Performance\Http\Controllers;

use App\Helper\Reply;
use Modules\Performance\Entities\Agenda;
use App\Http\Controllers\AccountBaseController;
use App\Models\EmployeeDetails;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Modules\Performance\Entities\Meeting;
use Modules\Performance\Entities\PerformanceSetting;
use Modules\Performance\Http\Requests\AgendaRequest;

class AgendaController extends AccountBaseController
{

    public function __construct()
    {
        parent::__construct();
        $this->pageTitle = 'performance::app.agenda';
    }

    public function index()
    {
        return redirect()->route('meetings.index');
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {
        $meetingId = request()->meetingId;
        abort_403($this->checkManageAccess($meetingId));
        $this->hasAccess = !$this->checkManageAccess($meetingId);

        $this->pageTitle = __('performance::app.addAgenda');
        $this->meeting = Meeting::findOrFail($meetingId);
        $this->employees = User::allEmployees(null, true);
        $this->tab = request()->tab;

        if (request()->page == 'modal') {
            return view('performance::meetings.agenda.add-agenda', $this->data);
        }

        if (request()->ajax()) {
            $html = view('performance::meetings.agenda.create', $this->data)->render();
            return Reply::dataOnly(['status' => 'success', 'html' => $html, 'title' => $this->pageTitle]);
        }

        $this->view = 'performance::meetings.agenda.create';

        return view('performance::meetings.create', $this->data);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(AgendaRequest $request)
    {
        abort_403($this->checkManageAccess($request->meeting_id));
        $this->hasAccess = !$this->checkManageAccess($request->meeting_id);

        DB::beginTransaction();

        $meetings = Meeting::where('id', $request->meeting_id)
        ->orWhere('parent_id', $request->meeting_id)
        ->get();

        foreach ($meetings as $meeting) {
            if (isset($request->discussion_points)) {
                foreach ($request->discussion_points as $key => $point) {
                    $agenda = new Agenda();
                    $agenda->meeting_id = $meeting->id;
                    $agenda->discussion_point = $point;
                    $agenda->added_by = user()->id;
                    $agenda->keep_private = isset($request->keep_private[$key]) && $request->keep_private[$key] == 'yes' ? 'yes' : 'no';
                    $agenda->save();
                }
            }
        }

        $meeting = Meeting::findOrFail($request->meeting_id);

        if ($request->send_mail == 'no') {
            $tab = $request->tab ?? 'list';

            $agenda = new Agenda();
            $agenda->meeting_id = $meeting->id;
            $agenda->discussion_point = $request->discussion_point;
            $agenda->added_by = user()->id;
            $agenda->keep_private = $request->keep_private == 'yes' ? 'yes' : 'no';
            $agenda->save();

            DB::commit();

            $this->meeting = Meeting::with(['meetingBy', 'meetingFor', 'agendas'])->select('performance_meetings.*')->where('id', $meeting->id)->first();

            $view = 'performance::meetings.ajax.discussion';
            $html = view($view, $this->data)->render();

            return Reply::successWithData(__('messages.recordSaved'), ['status' => 'success', 'activeTab' => 'discussion', 'html' => $html, 'title' => $this->pageTitle]);
        }

        DB::commit();

        $tab = $request->tab ?? 'calendar';

        return Reply::successWithData(__('messages.recordSaved'), ['tab' => $tab]);
    }

    /**
     * Display the specified resource.
     */
    public function show($id)
    {
        $this->agenda = Agenda::findOrFail($id);
        abort_403($this->checkViewAccess($this->agenda->meeting_id));

        return view('performance::meetings.agenda.show', $this->data);
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit($id)
    {
        $this->agenda = Agenda::findOrFail($id);
        abort_403($this->checkManageAccess($this->agenda->meeting_id));

        return view('performance::meetings.agenda.edit', $this->data);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(AgendaRequest $request, $id)
    {
        $agenda = Agenda::findOrFail($id);
        abort_403($this->checkManageAccess($agenda->meeting_id));
        $this->hasAccess = !$this->checkManageAccess($agenda->meeting_id);

        $agenda->discussion_point = $request->discussion_point;
        $agenda->keep_private = $request->keep_private == 'yes' ? 'yes' : 'no';
        $agenda->save();

        $this->meeting = Meeting::with(['meetingBy', 'meetingFor', 'agendas'])->select('performance_meetings.*')->where('id', $agenda->meeting_id)->first();

        $view = 'performance::meetings.ajax.discussion';
        $html = view($view, $this->data)->render();

        return Reply::successWithData(__('messages.updateSuccess'), ['status' => 'success', 'activeTab' => 'discussion', 'html' => $html, 'title' => $this->pageTitle]);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy($id)
    {
        $agenda = Agenda::findOrFail($id);
        abort_403($this->checkManageAccess($agenda->meeting_id));
        $this->hasAccess = !$this->checkManageAccess($agenda->meeting_id);

        $meetingId = $agenda->meeting_id;
        $agenda->delete();

        $this->meeting = Meeting::with(['meetingBy', 'meetingFor', 'agendas'])->select('performance_meetings.*')->where('id', $meetingId)->first();

        $view = 'performance::meetings.ajax.discussion';
        $html = view($view, $this->data)->render();

        return Reply::successWithData(__('messages.deleteSuccess'), ['status' => 'success', 'activeTab' => 'discussion', 'html' => $html, 'title' => $this->pageTitle]);
    }

    public function markAsDiscussed()
    {
        $id = request()->id;
        $agenda = Agenda::findOrFail($id);
        abort_403($this->checkManageAccess($agenda->meeting_id));
        $this->hasAccess = !$this->checkManageAccess($agenda->meeting_id);

        $agenda->is_discussed = 'yes';
        $agenda->save();

        $this->meeting = Meeting::with(['meetingBy', 'meetingFor', 'agendas'])->select('performance_meetings.*')->where('id', $agenda->meeting_id)->first();

        $view = 'performance::meetings.ajax.discussion';
        $html = view($view, $this->data)->render();

        return Reply::successWithData(__('messages.recordSaved'), ['status' => 'success', 'activeTab' => 'discussion', 'html' => $html, 'title' => $this->pageTitle]);
    }

    protected function checkViewAccess($id)
    {
        $meetingSetting = PerformanceSetting::first();
        $canViewManager = $meetingSetting->view_meeting_manager;
        $canViewParticipant = $meetingSetting->view_meeting_participant;

        $meeting = Meeting::with(['meetingBy', 'meetingFor'])->findOrFail($id);

        $ownerId = $meeting->meeting_by;
        $participantId = $meeting->meeting_for;

        $managerIds = EmployeeDetails::whereNotNull('reporting_to')
            ->where('user_id', $participantId)
            ->pluck('reporting_to')
            ->toArray();

        $currentUserRoleIds = user()->roles()->pluck('id')->toArray();
        $viewByRoles = json_decode($meetingSetting->view_meeting_roles, true) ?? [];

        return !(user()->hasRole('admin') || $ownerId == user()->id ||
            ($canViewManager == 1 && in_array(user()->id, $managerIds)) ||
            ($canViewParticipant == 1 && ($ownerId == user()->id || $participantId == user()->id)) ||
            (!empty($viewByRoles) && array_intersect($currentUserRoleIds, $viewByRoles)));
    }

    protected function checkManageAccess($id)
    {
        $meetingSetting = PerformanceSetting::first();
        $canManageManager = $meetingSetting->create_meeting_manager;
        $canManageParticipant = $meetingSetting->create_meeting_participant;

        $meeting = Meeting::with(['meetingBy', 'meetingFor'])->findOrFail($id);

        $ownerId = $meeting->meeting_by;
        $participantId = $meeting->meeting_for;

        $managerIds = EmployeeDetails::whereNotNull('reporting_to')
            ->where('user_id', $participantId)
            ->pluck('reporting_to')
            ->toArray();

        $currentUserRoleIds = user()->roles()->pluck('id')->toArray();
        $manageByRoles = json_decode($meetingSetting->create_meeting_roles, true) ?? [];

        return !(user()->hasRole('admin') || $ownerId == user()->id ||
            ($canManageManager == 1 && in_array(user()->id, $managerIds)) ||
            ($canManageParticipant == 1 && ($ownerId == user()->id || $participantId == user()->id)) ||
            (!empty($manageByRoles) && array_intersect($currentUserRoleIds, $manageByRoles)));
    }

}
