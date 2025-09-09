<?php

namespace Modules\Performance\Http\Controllers;

use App\Helper\Reply;
use App\Http\Controllers\AccountBaseController;
use App\Models\EmployeeDetails;
use App\Models\Project;
use App\Models\Team;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Performance\Entities\GoalType;
use Modules\Performance\Entities\Meeting;
use Modules\Performance\Entities\Objective;
use Modules\Performance\Entities\ObjectiveOwner;
use Modules\Performance\Entities\ObjectiveProgressStatus;
use Modules\Performance\Entities\PerformanceSetting;
use Modules\Performance\Http\Requests\CreateObjectiveRequest;

class ObjectiveController extends AccountBaseController
{

    public function __construct()
    {
        parent::__construct();
        $this->pageTitle = 'performance::app.objective';

        $this->middleware(function ($request, $next) {
            abort_403(!in_array(PerformanceSetting::MODULE_NAME, $this->user->modules));
            return $next($request);
        });
    }

    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        $this->departments = Team::all();
        $this->employees = User::allEmployees(null, true);
        $this->projects = Project::allProjects();
        $this->statuses = [
            'onTrack' => __('performance::statuses.on-track'),
            'atRisk' => __('performance::statuses.at-risk'),
            'offTrack' => __('performance::statuses.off-track'),
            'completed' => __('performance::statuses.completed'),
        ];

        $objectives = Objective::with(['owners', 'goalType', 'department', 'status', 'keyResults']);

        if (request()->startDate != 'all' && request()->endDate != '') {
            $startDate = Carbon::createFromFormat($this->company->date_format, request()->startDate)->format('Y-m-d');
            $endDate = Carbon::createFromFormat($this->company->date_format, request()->endDate)->format('Y-m-d');

            $objectives->where(
                function ($query) use ($startDate, $endDate) {
                    return $query->whereBetween('start_date', [$startDate, $endDate])
                        ->orWhereBetween('end_date', [$startDate, $endDate]);
                }
            );
        }

        if (request()->has('searchText')) {
            $objectives->where('title', 'like', '%' . request()->searchText . '%');
        }

        if (request()->department != 'all' && request()->department != '') {
            $objectives->where('objectives.department_id', request()->department);
        }

        if (request()->project != 'all' && request()->project != '') {
            $objectives->where('project_id', request()->project);
        }

        if (request()->owner != 'all' && request()->owner != '') {
            $objectives->whereHas('owners', function ($query) {
                $query->where('owner_id', request()->owner);
            });
        }

        if (request()->status != 'all' && request()->status != 'incomplete' && request()->status != '') {
            $objectives->whereHas('status', function ($query) {
                $query->where('status', request()->status);
            });
        }
        elseif (request()->status == 'incomplete' && request()->status != '' && request()->status != 'all') {
            $objectives->whereHas('status', function ($query) {
                $query->whereNot('status', 'completed');
            });
        }
        else if (request()->status != 'all' || request()->status == '') {
            $objectives->whereHas('status', function ($query) {
                $query->whereNot('status', 'completed');
            });
        }

        $allObjectives = $objectives->orderByDesc('id')->get();

        // Filter objectives based on user access
        $this->objectives = $allObjectives->filter(function ($objective) {
            $objective->has_access = !$this->checkManageAccess($objective->id);
            return !$this->checkViewAccess($objective->id);
        });

        if (request()->ajax()) {
            $view = view('performance::objectives.ajax.objectives', $this->data)->render();
            return Reply::dataOnly(['status' => 'success', 'html' => $view]);
        }

        return view('performance::objectives.index', $this->data);
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {
        $this->pageTitle = __('performance::app.addObjective');

        $this->goalTypes = GoalType::all();
        $this->teams = Team::all();
        $this->dates = range(1, 30);
        $this->priorities = ['low' => __('app.low'), 'medium' => __('app.medium'), 'high' => __('app.high')];
        $this->employees = User::allEmployees(null, true);
        $this->checkInFrequency = ['daily' => __('app.daily'), 'weekly' => __('app.weekly'), 'bi-weekly' => __('app.bi-weekly'), 'monthly' => __('app.monthly'), 'quarterly' => __('app.quarterly')];

        $this->projects = Project::allProjects(true);

        $this->meetingId = (request()->requestFrom === 'meeting') ? request()->meetingId : null;

        $this->currentUrl = $this->meetingId
            ? route('meetings.show', ['meeting' => $this->meetingId]) . '?view=action'
            : route('objectives.index');

        if (request()->ajax()) {
            $html = view('performance::objectives.ajax.create', $this->data)->render();
            return Reply::dataOnly(['status' => 'success', 'html' => $html, 'title' => $this->pageTitle]);
        }

        $this->view = 'performance::objectives.ajax.create';

        return view('performance::objectives.create', $this->data);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(CreateObjectiveRequest $request)
    {
        DB::beginTransaction();
        $goalType = GoalType::findOrFail($request->goal_type);

        $objective = new Objective();
        $objective->title = $request->title;
        $objective->description = trim_editor($request->description);
        $objective->goal_type = $request->goal_type;
        $objective->department_id = $goalType->type == 'department' ? $request->department_id : null;
        $objective->start_date = $request->start_date ? companyToYmd($request->start_date) : now()->format('Y-m-d');
        $objective->end_date = $request->end_date ? companyToYmd($request->end_date) : now()->format('Y-m-d');
        $objective->priority = $request->priority;
        $objective->check_in_frequency = $request->check_in_frequency;
        $objective->schedule_on = ($request->check_in_frequency == 'weekly' || $request->check_in_frequency == 'bi-weekly') ? $request->schedule_on : null;
        $objective->rotation_date = ($request->check_in_frequency == 'monthly' || $request->check_in_frequency == 'quarterly') ? $request->rotation_date : null;
        $objective->send_check_in_reminder = $request->send_check_in_reminder ? true : false;
        $objective->project_id = $request->project_id;
        $objective->save();

        if (isset($request->owner_id)) {
            foreach ($request->owner_id as $key => $user) {
                $owner = new ObjectiveOwner();
                $owner->objective_id = $objective->id;
                $owner->owner_id = $user;
                $owner->save();
            }
        }

        if ((!is_null(request()->meeting_id))) {
            $meeting = Meeting::findOrFail(request()->meeting_id);
            $meeting->objective_id = $objective->id;
            $meeting ->save();
            $meetingId = $meeting->id;
        }
        else {
            $meetingId = null;
        }

        $totalDays = Carbon::parse($objective->start_date)->diffInDays($objective->end_date);
        $elapsedDays = Carbon::parse($objective->start_date)->diffInDays(Carbon::now());

        $remainingDays = $totalDays - $elapsedDays;
        $timeLeftPercentage = $totalDays > 0 ? ($remainingDays / $totalDays) * 100 : 0;

        $objectiveProgressStatus = [
            'objective_id' => $objective->id,
            'status' => 'onTrack',
            'objective_progress' => 0.00,
            'time_left_percentage' => $timeLeftPercentage,
            'color' => 'primary',
        ];

        ObjectiveProgressStatus::Create($objectiveProgressStatus);
        DB::commit();

        return Reply::successWithData(__('messages.recordSaved'), ['objectiveId' => $objective->id, 'meetingId' => $meetingId]);
    }

    /**
     * Show the specified resource.
     */
    public function show($id)
    {
        abort_403($this->checkViewAccess($id));

        $this->managePermission = $this->checkManageAccess($id);
        $this->objective = Objective::findOrFail($id);
        $this->pageTitle = $this->objective->title;
        $this->dates = range(1, 30);
        $this->view = 'performance::objectives.ajax.show';

        if (request()->ajax()) {
            return $this->returnAjax($this->view);
        }

        return view('performance::objectives.create', $this->data);
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit($id)
    {
        abort_403($this->checkManageAccess($id));
        $this->pageTitle = __('performance::app.editObjective');

        $this->objective = Objective::findOrFail($id);
        $this->goalTypes = GoalType::all();
        $this->teams = Team::all();
        $this->employees = User::allEmployees(null, true);
        $this->dates = range(1, 30);
        $this->ownerArray = ObjectiveOwner::where('objective_id', $id)->pluck('owner_id')->toArray();
        $this->priorities = ['low' => __('app.low'), 'medium' => __('app.medium'), 'high' => __('app.high')];
        $this->checkInFrequency = ['daily' => __('app.daily'), 'weekly' => __('app.weekly'), 'bi-weekly' => __('app.bi-weekly'), 'monthly' => __('app.monthly'), 'quarterly' => __('app.quarterly')];

        if (request()->ajax()) {
            $html = view('performance::objectives.ajax.edit', $this->data)->render();
            return Reply::dataOnly(['status' => 'success', 'html' => $html, 'title' => $this->pageTitle]);
        }

        $this->view = 'performance::objectives.ajax.edit';

        return view('performance::objectives.create', $this->data);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(CreateObjectiveRequest $request, $id)
    {
        abort_403($this->checkManageAccess($id));

        DB::beginTransaction();
        $goalType = GoalType::findOrFail($request->goal_type);

        $objective = Objective::findOrFail($id);
        $objective->title = $request->title;
        $objective->description = trim_editor($request->description);
        $objective->goal_type = $request->goal_type;
        $objective->department_id = $goalType->type == 'department' ? $request->department_id : null;
        $objective->start_date = $request->start_date ? companyToYmd($request->start_date) : now()->format('Y-m-d');
        $objective->end_date = $request->end_date ? companyToYmd($request->end_date) : now()->format('Y-m-d');
        $objective->priority = $request->priority;
        $objective->check_in_frequency = $request->check_in_frequency;
        $objective->schedule_on = ($request->check_in_frequency == 'weekly' || $request->check_in_frequency == 'bi-weekly') ? $request->schedule_on : null;
        $objective->rotation_date = ($request->check_in_frequency == 'monthly' || $request->check_in_frequency == 'quarterly') ? $request->rotation_date : null;
        $objective->send_check_in_reminder = $request->send_check_in_reminder ? true : false;
        $objective->save();

        if (isset($request->owner_id)) {
            $objective->owners()->detach();

            foreach ($request->owner_id as $user) {
                $owner = new ObjectiveOwner();
                $owner->objective_id = $objective->id;
                $owner->owner_id = $user;
                $owner->save();
            }
        }

        DB::commit();

        return Reply::success(__('messages.updateSuccess'));
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy($id)
    {
        abort_403($this->checkManageAccess($id));

        $objective = Objective::findOrFail($id);

        if ($objective) {
            $objective->keyResults()->each(function ($keyResult) {
                $keyResult->checkIns()->delete();
            });

            $objective->keyResults()->delete();
            $objective->delete();
            return Reply::success(__('messages.deleteSuccess'));
        }

        return Reply::error(__('performance::messages.objectiveNotFound'));
    }

    public function showDescription($id)
    {
        abort_403($this->checkManageAccess($id));

        $this->objective = Objective::findOrFail($id);
        return view('performance::objectives.ajax.show-description', $this->data);
    }

    protected function checkViewAccess($id)
    {
        $objective = Objective::with('owners')->findOrFail($id);
        $ownerIds = $objective->owners->pluck('id')->toArray();
        $goal = GoalType::find($objective->goal_type);

        $managerIds = EmployeeDetails::whereNotNull('reporting_to')
            ->whereIn('user_id', $ownerIds)
            ->pluck('reporting_to')
            ->toArray();

        $currentUserRoleIds = user()->roles()->pluck('id')->toArray();
        $viewByRoles = json_decode($goal->view_by_roles, true) ?? [];

        return !(($goal && $goal->view_by_owner == 1 && in_array(user()->id, $ownerIds)) ||
            ($goal && $goal->view_by_manager == 1 && in_array(user()->id, $managerIds)) ||
            (!empty($viewByRoles) && array_intersect($currentUserRoleIds, $viewByRoles)) ||
            user()->hasRole('admin') || $objective->created_by == user()->id);
    }

    protected function checkManageAccess($id)
    {
        $objective = Objective::with('owners')->findOrFail($id);
        $ownerIds = $objective->owners->pluck('id')->toArray();
        $goal = GoalType::find($objective->goal_type);

        $managerIds = EmployeeDetails::whereNotNull('reporting_to')
            ->whereIn('user_id', $ownerIds)
            ->pluck('reporting_to')
            ->toArray();

        $currentUserRoleIds = user()->roles()->pluck('id')->toArray();
        $manageByRoles = json_decode($goal->manage_by_roles, true) ?? [];

        return !(user()->hasRole('admin') ||
            $objective->created_by == user()->id ||
            ($goal && $goal->manage_by_owner == 1 && in_array(user()->id, $ownerIds)) ||
            ($goal && $goal->manage_by_manager == 1 && in_array(user()->id, $managerIds)) ||
            (!empty($manageByRoles) && array_intersect($currentUserRoleIds, $manageByRoles)));
    }

}
