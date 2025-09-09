<?php

namespace Modules\RestAPI\Http\Controllers;

use App\Models\TaskboardColumn;
use Froiden\RestAPI\ApiResponse;
use Modules\RestAPI\Entities\Invoice;
use Modules\RestAPI\Entities\Project;
use Modules\RestAPI\Entities\Task;

class DashboardController extends ApiBaseController
{
    public function dashboard()
    {
        $taskBoardColumn = TaskboardColumn::all();

        $completedTaskColumn = $taskBoardColumn->filter(function ($value, $key) {
            return $value->slug == 'completed';
        })->first();

        $totalProjects = Project::select('projects.id')
            ->get()
            ->count();

        $pendingTasks = Task::select('tasks.id')
            ->where('board_column_id', '!=', $completedTaskColumn->id)
            ->get()
            ->count();

        $unpaidInvoices = Invoice::select('invoices.id')
            ->where('status', 'unpaid')
            ->get()
            ->count();

        return ApiResponse::make(null, [
            'unpaidInvoices' => $unpaidInvoices,
            'totalProjects' => $totalProjects,
            'pendingTasks' => $pendingTasks,
        ]);
    }

    public function myDashboard()
    {
        $taskBoardColumn = TaskboardColumn::all();

        $completedTaskColumn = $taskBoardColumn->filter(function ($value, $key) {
            return $value->slug == 'completed';
        })->first();

        $totalProjects = Project::select('projects.id')
            ->join('project_members', 'project_members.project_id', '=', 'projects.id')
            ->where('project_members.user_id', '=', api_user()->id)
            ->groupBy('projects.id')
            ->get()
            ->count();

        $pendingTasks = Task::select('tasks.id')
            ->where('board_column_id', '!=', $completedTaskColumn->id)
            ->join('task_users', 'task_users.task_id', '=', 'tasks.id')
            ->where('task_users.user_id', '=', api_user()->id)
            ->groupBy('tasks.id')
            ->get()
            ->count();

        $unpaidInvoices = Invoice::select('invoices.id')
            ->where('status', 'unpaid')
            ->get()
            ->count();

        return ApiResponse::make(null, [
            'unpaidInvoices' => $unpaidInvoices,
            'totalProjects' => $totalProjects,
            'pendingTasks' => $pendingTasks,
        ]);
    }
}
