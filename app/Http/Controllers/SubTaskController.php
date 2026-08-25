<?php

namespace App\Http\Controllers;

use App\Helper\Reply;
use App\Http\Requests\SubTask\StoreSubTask;
use App\Models\SubTask;
use App\Models\Task;
use Illuminate\Http\Request;
use App\Helper\UserService;
use App\Models\ClientContact;
use Illuminate\Support\Facades\Log;

class SubTaskController extends AccountBaseController
{

    /**
     * Show the form for creating a new resource.
     *
     * @return \Illuminate\Http\Response
     */
    public function edit($id)
    {
        $this->subTask = SubTask::with(['files'])->findOrFail($id);
        return view('tasks.sub_tasks.edit', $this->data);
    }

    /**
     * Show the form for creating a new resource.
     *
     * @return \Illuminate\Http\Response
     */
    public function show($id)
    {
        $this->subTask = SubTask::with(['files'])->findOrFail($id);
        return view('tasks.sub_tasks.detail', $this->data);
    }

    /**
     * @param StoreSubTask $request
     * @return array
     * @throws \Froiden\RestAPI\Exceptions\RelatedResourceNotFoundException
     */
    public function store(StoreSubTask $request)
    {
        $this->addPermission = user()->permission('add_sub_tasks');
        $task = Task::findOrFail($request->task_id);
        $taskUsers = $task->users->pluck('id')->toArray();
        $userId = UserService::getUserId();

        abort_403(!(
            $this->addPermission == 'all'
            || ($this->addPermission == 'added' && ($task->added_by == user()->id || $task->added_by == $userId))
            || ($this->addPermission == 'owned' && in_array(user()->id, $taskUsers))
            || ($this->addPermission == 'added' && (in_array(user()->id, $taskUsers) || $task->added_by == user()->id || $task->added_by == $userId))
        ));

        $subTask = new SubTask();
        $subTask->title = $request->title;
        $subTask->task_id = $request->task_id;
        $subTask->description = trim_editor($request->description);

        $subTask->start_date = ($request->start_date != '') ? companyToYmd($request->start_date) : null;
        $subTask->due_date = ($request->due_date != '') ? companyToYmd($request->due_date) : null;

        $subTask->assigned_to = $request->user_id ? $request->user_id : null;

        // The redesigned task detail's checklist is a plain checkbox list
        // backed by this same SubTask table — ticking/adding an item isn't
        // an assignment or a milestone worth emailing/notifying anyone
        // about, unlike a real sub-task. The frontend flags these requests
        // so SubTaskCompletedListener can skip notifications just for them.
        $this->withSubTaskNotificationsSuppressedIfChecklist($request, fn () => $subTask->save());

        $task = $subTask->task;
        $this->task = Task::with(['subtasks', 'subtasks.files'])->findOrFail($subTask->task_id);
        $this->logTaskActivity($task->id, $this->user->id, 'subTaskCreateActivity', $task->board_column_id, $subTask->id);
        $view = view('tasks.sub_tasks.show', $this->data)->render();
        return Reply::successWithData(__('messages.recordSaved'), [ 'subTaskID' => $subTask->id, 'view' => $view]);

    }

    /**
     * Remove the specified resource from storage.
     *
     * @param  int  $id
     * @return \Illuminate\Http\Response
     */
    public function destroy($id)
    {
        $subTask = SubTask::findOrFail($id);
        $this->withSubTaskNotificationsSuppressedIfChecklist(
            request(),
            fn () => SubTask::destroy($id),
        );

        $this->userId = UserService::getUserId();
        $this->clientIds = ClientContact::where('user_id', $this->userId)->pluck('client_id')->toArray();

        $this->task = Task::with(['subtasks', 'subtasks.files'])->findOrFail($subTask->task_id);
        $view = view('tasks.sub_tasks.show', $this->data)->render();

        return Reply::successWithData(__('messages.deleteSuccess'), ['view' => $view]);
    }

    public function changeStatus(Request $request)
    {
        try {
            $subTask = SubTask::findOrFail($request->subTaskId);
            $subTask->status = $request->status;
            $this->withSubTaskNotificationsSuppressedIfChecklist($request, fn () => $subTask->save());

            $this->task = Task::with(['subtasks', 'subtasks.files'])->findOrFail($subTask->task_id);
            $this->logTaskActivity($this->task->id, user()->id, 'subTaskUpdateActivity', $this->task ->board_column_id, $subTask->id);

            $view = view('tasks.sub_tasks.show', $this->data)->render();

            return Reply::successWithData(__('messages.updateSuccess'), ['view' => $view]);
        } catch (\Exception $e) {
            Log::error('SubTaskController::changeStatus failed', [
                'subTaskId' => $request->subTaskId,
                'status' => $request->status,
                'error' => $e->getMessage(),
            ]);

            return response()->json(Reply::error($e->getMessage()), 500);
        }
    }

    /**
     * @param StoreSubTask $request
     * @param int $id
     * @return array
     * @throws \Froiden\RestAPI\Exceptions\RelatedResourceNotFoundException
     */
    public function update(StoreSubTask $request, $id)
    {

        $this->userId = UserService::getUserId();
        $this->clientIds = ClientContact::where('user_id', $this->userId)->pluck('client_id')->toArray();

        $subTask = SubTask::findOrFail($id);
        $subTask->title = $request->title;
        $subTask->description = trim_editor($request->description);
        $subTask->start_date = ($request->start_date != '') ? companyToYmd($request->start_date) : null;
        $subTask->due_date = ($request->due_date != '') ? companyToYmd($request->due_date) : null;
        $subTask->assigned_to = $request->user_id ? $request->user_id : null;
        $subTask->save();

        $task = $subTask->task;
        $this->logTaskActivity($task->id, $this->user->id, 'subTaskUpdateActivity', $task->board_column_id, $subTask->id);

        $this->task = Task::with(['subtasks', 'subtasks.files'])->findOrFail($subTask->task_id);
        $view = view('tasks.sub_tasks.show', $this->data)->render();

        return Reply::successWithData(__('messages.updateSuccess'), ['view' => $view]);
    }

    /**
     * Runs $action (a save()/destroy()) with SubTask notifications suppressed
     * when the request is flagged `checklist=1` — set by the redesigned task
     * detail's checklist (useTaskCheckpoints.ts), never by the legacy Sub
     * Tasks UI, so real sub-task assignment/completion notifications are
     * untouched. SubTaskCompletedListener checks this same container flag.
     */
    private function withSubTaskNotificationsSuppressedIfChecklist(Request $request, \Closure $action): void
    {
        if (!$request->boolean('checklist')) {
            $action();

            return;
        }

        app()->instance('suppress_subtask_notifications', true);

        try {
            $action();
        } finally {
            app()->forgetInstance('suppress_subtask_notifications');
        }
    }

}
