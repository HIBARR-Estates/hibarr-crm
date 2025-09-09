<?php

namespace Modules\ProjectRoadmap\Http\Controllers;

use Carbon\Carbon;
use App\Models\Task;
use App\Models\Team;
use App\Models\User;
use App\Helper\Files;
use App\Helper\Reply;
use App\Models\Pinned;
use App\Models\Expense;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Project;
use App\Models\SubTask;
use App\Models\Currency;
use App\Models\TaskUser;
use App\Models\BankAccount;
use App\Models\ProjectFile;
use App\Models\ProjectNote;
use App\Models\SubTaskFile;
use App\Scopes\ActiveScope;
use App\Traits\ImportExcel;
use Illuminate\Http\Request;
use App\Models\ProjectMember;
use App\Imports\ProjectImport;
use App\Jobs\ImportProjectJob;
use App\Models\MessageSetting;
use App\Models\ProjectTimeLog;
use App\Models\ProjectActivity;
use App\Models\ProjectCategory;
use App\Models\ProjectTemplate;
use App\Models\TaskboardColumn;
use App\Traits\ProjectProgress;
use App\Models\ProjectMilestone;
use App\Models\DiscussionCategory;
use Illuminate\Support\Facades\DB;
use App\DataTables\TicketDataTable;
use App\Models\ProjectTimeLogBreak;
use App\Models\ProjectStatusSetting;
use App\DataTables\ExpensesDataTable;
use App\DataTables\InvoicesDataTable;
use App\DataTables\PaymentsDataTable;
use App\DataTables\ProjectsDataTable;
use App\DataTables\TimeLogsDataTable;
use App\DataTables\DiscussionDataTable;
use App\DataTables\ArchiveTasksDataTable;
use App\DataTables\ProjectNotesDataTable;
use App\Http\Requests\Project\StoreProject;
use App\DataTables\ArchiveProjectsDataTable;
use App\Http\Requests\Project\UpdateProject;
use App\Http\Controllers\AccountBaseController;
use App\Http\Requests\Admin\Employee\ImportRequest;
use App\Http\Requests\Admin\Employee\ImportProcessRequest;
use Symfony\Component\Mailer\Exception\TransportException;
use Modules\ProjectRoadmap\DataTables\ProjectTasksDataTable;
use Modules\ProjectRoadmap\DataTables\ProjectRoadmapDataTable;

class ProjectRoadmapController extends AccountBaseController
{

    use ProjectProgress, ImportExcel;

    public function __construct()
    {
        parent::__construct();
        $this->pageTitle = 'projectroadmap::app.menu.projectRoadmap';
        $this->middleware(function ($request, $next) {
            abort_403(!in_array('projects', $this->user->modules));

            return $next($request);
        });
    }

    /**
     * Display a listing of the resource.
     * @return Renderable
     */

    public function index(ProjectRoadmapDataTable $dataTable)
    {
        $viewPermission = user()->permission('view_projects');
        abort_403((!in_array($viewPermission, ['all', 'added', 'owned', 'both'])));

        if (!request()->ajax()) {

            if (in_array('client', user_roles())) {
                $this->clients = User::client();
            }
            else {
                $this->clients = User::allClients();
                $this->allEmployees = User::allEmployees(null, true, ($viewPermission == 'all' ? 'all' : null));
            }

            $this->categories = ProjectCategory::all();
            $this->departments = Team::all();
            $this->projectStatus = ProjectStatusSetting::where('status', 'active')->get();
        }

        return $dataTable->render('projectroadmap::index', $this->data);

    }

    /**
     * Show the specified resource.
     * @param int $id
     * @return Renderable
     */

    public function show($id, ProjectTasksDataTable $dataTable)
    {

        $this->viewPermission = user()->permission('view_projects');
        $viewFilePermission = user()->permission('view_project_files');
        $this->viewMiroboardPermission = user()->permission('view_miroboard');
        $viewMilestonePermission = user()->permission('view_project_milestones');
        $this->viewPaymentPermission = user()->permission('view_project_payments');
        $this->viewProjectTimelogPermission = user()->permission('view_project_timelogs');
        $this->viewExpensePermission = user()->permission('view_project_expenses');
        $this->viewRatingPermission = user()->permission('view_project_rating');
        $this->viewBurndownChartPermission = user()->permission('view_project_burndown_chart');
        $this->viewProjectMemberPermission = user()->permission('view_project_members');

        $this->project = Project::with(['client', 'members', 'members.user', 'mentionProject', 'members.user.session', 'members.user.employeeDetail.designation',
            'milestones' => function ($q) use ($viewMilestonePermission) {
                if ($viewMilestonePermission == 'added') {
                    $q->where('added_by', user()->id);
                }
            },
            'milestones.currency', 'files' => function ($q) use ($viewFilePermission) {
                if ($viewFilePermission == 'added') {
                    $q->where('added_by', user()->id);
                }
            }])
            ->withTrashed()
            ->findOrFail($id)
            ->withCustomFields();

        $this->projectStatusColor = ProjectStatusSetting::where('status_name', $this->project->status)->first();
        $memberIds = $this->project->members->pluck('user_id')->toArray();
        $mentionIds = $this->project->mentionProject->pluck('user_id')->toArray();

        $query = Task::leftJoin('task_users', 'tasks.id', '=', 'task_users.task_id')
            ->select(
                'task_users.user_id',
                DB::raw('COUNT(DISTINCT task_users.id) AS assigned_tasks'),
                DB::raw('COUNT(DISTINCT CASE WHEN tasks.status = "completed" THEN task_users.id END) AS completed_tasks'),
                DB::raw('COUNT(DISTINCT CASE WHEN tasks.status = "incomplete" AND (tasks.due_date IS NULL OR tasks.due_date < NOW()) THEN task_users.id END) AS late_tasks')
            )
            ->whereIn('task_users.user_id', $memberIds)
            ->where('tasks.project_id', $this->project->id)
            ->groupBy('task_users.user_id');

        $taskCounts = $query->get()->pluck('assigned_tasks', 'user_id');
        $completedTaskCounts = $query->get()->pluck('completed_tasks', 'user_id');
        $lateTaskCounts = $query->get()->pluck('late_tasks', 'user_id');

        $totalHours = ProjectTimeLog::select('user_id', DB::raw('SUM(total_hours) as total_logged_hours'))
            ->whereIn('user_id', $memberIds)
            ->where('project_id', $this->project->id)
            ->groupBy('user_id')
            ->pluck('total_logged_hours', 'user_id');

        $this->data['taskCounts'] = $taskCounts;
        $this->data['completedTaskCounts'] = $completedTaskCounts;
        $this->data['lateTaskCounts'] = $lateTaskCounts;
        $this->data['totalHours'] = $totalHours;

        abort_403(!(
            $this->viewPermission == 'all'
            || $this->project->public
            || ($this->viewPermission == 'added' && user()->id == $this->project->added_by)
            || ($this->viewPermission == 'owned' && user()->id == $this->project->client_id && in_array('client', user_roles()))
            || ($this->viewPermission == 'owned' && in_array(user()->id, $memberIds) && in_array('employee', user_roles()))
            || ($this->viewPermission == 'both' && (user()->id == $this->project->client_id || user()->id == $this->project->added_by))
            || ($this->viewPermission == 'both' && (in_array(user()->id, $memberIds) || user()->id == $this->project->added_by) && in_array('employee', user_roles()))
            || (($this->viewPermission == 'none') && (!is_null(($this->project->mentionProject))) && in_array(user()->id, $mentionIds))
        ));

        $this->pageTitle = $this->project->project_name;

        $this->milestoneChart = $this->milestoneStatusChartData($id);
        $this->taskChart = $this->taskChartData($id);
        $this->taskPriorityChart = $this->taskPriorityChartData($id);
        $hoursLogged = $this->project->times()->sum('total_minutes');

        $breakMinutes = ProjectTimeLogBreak::projectBreakMinutes($id);

        $this->hoursBudgetChart = $this->hoursBudgetChartData($this->project, $hoursLogged, $breakMinutes);

        $this->taskBoardStatus = TaskboardColumn::all();

        $this->view = 'projectroadmap::ajax.tasks';

        return $dataTable->render('projectroadmap::show', $this->data);

    }

    /**
     * XXXXXXXXXXX
     *
     * @return array
     */
    public function taskChartData($id)
    {
        $taskStatus = TaskboardColumn::all();
        $data['labels'] = $taskStatus->pluck('column_name');
        $data['colors'] = $taskStatus->pluck('label_color');
        $data['values'] = [];

        foreach ($taskStatus as $label) {
            $data['values'][] = Task::where('project_id', $id)->where('tasks.board_column_id', $label->id)->count();
        }

        return $data;
    }

    /**
     * XXXXXXXXXXX
     *
     * @return array
     */
    public function hoursBudgetChartData($project, $hoursLogged, $breakMinutes)
    {
        $hoursBudget = $project->hours_allocated ?: 0;

        $hoursLogged = intdiv($hoursLogged - $breakMinutes, 60);
        $overRun = $hoursLogged - $hoursBudget;
        $overRun = $overRun < 0 ? 0 : $overRun;
        $hoursLogged = ($hoursLogged > $hoursBudget) ? $hoursBudget : $hoursLogged;

        $data['labels'] = [__('app.planned'), __('app.actual')];
        $data['colors'] = ['#2cb100', '#d30000'];
        $data['threshold'] = $hoursBudget;
        $dataset = [
            [
                'name' => __('app.planned'),
                'values' => [$hoursBudget, $hoursLogged],
            ],
            [
                'name' => __('app.overrun'),
                'values' => [0, $overRun],
            ],
        ];
        $data['datasets'] = $dataset;

        return $data;
    }

    /**
     * XXXXXXXXXXX
     *
     * @return array
     */
    public function milestoneStatusChartData($id)
    {
        $completeStatus = ProjectMilestone::where('project_id', $id)->where('status', 'complete')->count();
        $incompleteStatus = ProjectMilestone::where('project_id', $id)->where('status', 'incomplete')->count();
        $data['labels'] = [__('app.complete'), __('app.incomplete')];
        $data['colors'] = ['#2cb100', '#d30000'];
        $data['values'] = [$completeStatus, $incompleteStatus];

        return $data;
    }

    public function taskPriorityChartData($id)
    {
        $taskPriority = Task::where('project_id', $id)->get()
            ->groupBy('priority')
            ->map
            ->count();

        $data = [
            'labels' => [],
            'values' => [],
            'colors' => ['rgba(153, 102, 255, 0.2)'],
            'name' => __('app.tasks'),
        ];

        foreach ($taskPriority as $key => $value) {
            $data['labels'][] = __('app.' . $key);
            $data['values'][] = $value;
        }

        return $data;
    }

}
