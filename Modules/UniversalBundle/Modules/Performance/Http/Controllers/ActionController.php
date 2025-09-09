<?php

namespace Modules\Performance\Http\Controllers;

use App\Models\User;
use App\Helper\Reply;
use App\Models\EmployeeDetails;
use Illuminate\Support\Facades\DB;
use Modules\Performance\Entities\Action;
use Modules\Performance\Entities\Meeting;
use App\Http\Controllers\AccountBaseController;
use Modules\Performance\Events\MeetingInviteEvent;
use Modules\Performance\Entities\PerformanceSetting;
use Modules\Performance\Http\Requests\ActionRequest;

class ActionController extends AccountBaseController
{

    public function __construct()
    {
        parent::__construct();
        $this->pageTitle = 'performance::app.action';
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

        $this->pageTitle = __('performance::app.addAction');
        $this->meeting = Meeting::findOrFail($meetingId);

        return view('performance::meetings.action.add-action', $this->data);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(ActionRequest $request)
    {
        $meeting = Meeting::findOrFail($request->meeting_id);
        abort_403($this->checkManageAccess($meeting->id));
        $this->hasAccess = !$this->checkManageAccess($meeting->id);

        DB::beginTransaction();

        if (isset($request->action_points)) {
            foreach ($request->action_points as $key => $point) {
                $action = new Action();
                $action->meeting_id = $meeting->id;
                $action->action_point = $point;
                $action->added_by = user()->id;
                $action->save();
            }
        }

        if ($request->send_mail == 'no') {
            $tab = $request->tab ?? 'list';

            $action = new Action();
            $action->meeting_id = $meeting->id;
            $action->action_point = $request->action_point;
            $action->added_by = user()->id;
            $action->save();

            DB::commit();

            $this->meeting = Meeting::with(['meetingBy', 'meetingFor', 'actions'])->select('performance_meetings.*')->where('id', $meeting->id)->first();

            $view = 'performance::meetings.ajax.action';
            $html = view($view, $this->data)->render();

            return Reply::successWithData(__('messages.recordSaved'), ['status' => 'success', 'activeTab' => 'actions', 'html' => $html, 'title' => $this->pageTitle]);
        }

        if ($meeting->meeting_for && $request->send_mail != 'no') {
            event(new MeetingInviteEvent($meeting, $meeting->meetingFor, $meeting->meetingBy));
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
        $this->action = Action::findOrFail($id);
        abort_403($this->checkViewAccess($this->action->meeting_id));

        return view('performance::meetings.action.show', $this->data);
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit($id)
    {
        $this->action = Action::findOrFail($id);
        abort_403($this->checkManageAccess($this->action->meeting_id));

        return view('performance::meetings.action.edit', $this->data);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(ActionRequest $request, $id)
    {
        $action = Action::findOrFail($id);
        abort_403($this->checkManageAccess($action->meeting_id));
        $this->hasAccess = !$this->checkManageAccess($action->meeting_id);

        $action->action_point = $request->action_point;
        $action->save();

        $this->meeting = Meeting::with(['meetingBy', 'meetingFor', 'actions'])->select('performance_meetings.*')->where('id', $action->meeting_id)->first();

        $view = 'performance::meetings.ajax.action';
        $html = view($view, $this->data)->render();

        return Reply::successWithData(__('messages.updateSuccess'), ['status' => 'success', 'activeTab' => 'actions', 'html' => $html, 'title' => $this->pageTitle]);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy($id)
    {
        $action = Action::findOrFail($id);
        abort_403($this->checkManageAccess($action->meeting_id));
        $this->hasAccess = !$this->checkManageAccess($action->meeting_id);

        $meetingId = $action->meeting_id;
        $action->delete();

        $this->meeting = Meeting::with(['meetingBy', 'meetingFor', 'actions'])->select('performance_meetings.*')->where('id', $meetingId)->first();

        $view = 'performance::meetings.ajax.action';
        $html = view($view, $this->data)->render();

        return Reply::successWithData(__('messages.deleteSuccess'), ['status' => 'success', 'activeTab' => 'actions', 'html' => $html, 'title' => $this->pageTitle]);
    }

    public function markAsActioned()
    {
        $id = request()->id;
        $action = Action::findOrFail($id);
        abort_403($this->checkManageAccess($action->meeting_id));
        $this->hasAccess = !$this->checkManageAccess($action->meeting_id);

        $action->is_actioned = 'yes';
        $action->save();

        $this->meeting = Meeting::with(['meetingBy', 'meetingFor', 'actions'])->select('performance_meetings.*')->where('id', $action->meeting_id)->first();

        $view = 'performance::meetings.ajax.action';
        $html = view($view, $this->data)->render();

        return Reply::successWithData(__('messages.recordSaved'), ['status' => 'success', 'activeTab' => 'actions', 'html' => $html, 'title' => $this->pageTitle]);
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
