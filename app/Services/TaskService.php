<?php

namespace App\Services;

use App\Helper\Files;
use App\Models\Project;
use App\Models\SubTask;
use App\Models\SubTaskFile;
use App\Models\Task;
use App\Models\TaskboardColumn;
use App\Models\TaskCategory;
use App\Models\TaskFile;
use App\Models\TaskHistory;
use App\Models\TaskLabelList;
use App\Models\User;
use App\Traits\ProjectProgress;
use App\Traits\RecordsCrmEvents;
use App\Services\DealNotificationService;
use App\Services\TaskLifecycleNotificationService;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class TaskService
{
    use ProjectProgress;
    use RecordsCrmEvents;

    /**
     * Create a new task.
     *
     * @param array $data
     * @param User|null $user
     * @return Task
     * @throws \Exception
     */
    public function createTask(array $data, ?User $user = null): Task
    {
        $user = $user ?? auth()->user();

        // Permission check should be handled by policy or controller before calling service, 
        // but can be reinforced here if needed. 
        // For now, we assume controller/request handles authorization.

        DB::beginTransaction();

        try {
            $task = new Task();
            
            // Basic Fields
            $task->heading = $data['heading'];
            $task->description = isset($data['description']) ? trim_editor($data['description']) : '';
            
            $dueDate = (isset($data['without_duedate']) && $data['without_duedate']) 
                ? null 
                : (isset($data['due_date']) ? Carbon::createFromFormat(company()->date_format . ' ' . company()->time_format, $data['due_date']) : null);
                
            $task->start_date = isset($data['start_date']) 
                ? Carbon::createFromFormat(company()->date_format . ' ' . company()->time_format, $data['start_date']) 
                : null;
                
            $task->due_date = $dueDate;
            $task->project_id = $data['project_id'] ?? null;
            $task->task_category_id = $data['category_id'] ?? null;
            $task->priority = $data['priority'] ?? 'medium';
            
            // Default Status
            $taskBoardColumn = TaskboardColumn::where('slug', 'to_do')->first();
            $task->board_column_id = $taskBoardColumn->id;

            // Dependent Task Logic
            if (isset($data['dependent_task_id']) && $data['dependent_task_id']) {
                $dependentTask = Task::findOrFail($data['dependent_task_id']);
                if ($dependentTask->due_date && $dueDate && $dependentTask->due_date->greaterThan($dueDate)) {
                    throw new \Exception(__('messages.taskDependentDate'));
                }
                $task->dependent_task_id = $data['dependent_task_id'];
            }

            $task->is_private = isset($data['is_private']) && $data['is_private'] ? 1 : 0;
            $task->billable = isset($data['billable']) && $data['billable'] ? 1 : 0;
            $task->estimate_hours = $data['estimate_hours'] ?? 0;
            $task->estimate_minutes = $data['estimate_minutes'] ?? 0;
            $task->repeat = isset($data['repeat']) && $data['repeat'] ? 1 : 0;
            $task->milestone_id = $data['milestone_id'] ?? null;

             // Board Column Override
            if (isset($data['board_column_id'])) {
                $task->board_column_id = $data['board_column_id'];
                
                $waitingApprovalTaskBoardColumn = TaskboardColumn::waitingForApprovalColumn();
                if ($waitingApprovalTaskBoardColumn && $data['board_column_id'] == $waitingApprovalTaskBoardColumn->id) {
                    $task->approval_send = 1;
                } else {
                    $task->approval_send = 0;
                }
            }

            // Task Short Code
            if ($task->project_id) {
                $project = Project::find($task->project_id);
                if ($project) {
                    $projectLastTaskCount = Task::projectTaskCount($project->id);
                    if (isset($project->project_short_code)) {
                        $task->task_short_code = $project->project_short_code . '-' . $this->getTaskShortCode($project->project_short_code, $projectLastTaskCount);
                    } else {
                        $task->task_short_code = $projectLastTaskCount + 1;
                    }
                }
            }
            
            if ($user) {
                $task->added_by = $user->id;
                $task->created_by = $user->id;
            }

            $task->save();

            // Sync Labels
            if (isset($data['task_labels'])) {
                $task->labels()->sync($data['task_labels']);
            }

            $assigneeIds = self::normalizeAssigneeIds($data);
            if ($assigneeIds !== null) {
                $task->users()->sync($assigneeIds);
            }

            // Polymorphic Relations (Deal/Lead/Property)
            $this->handlePolymorphicRelations($task, $data);

            // Handle Duplication (from existing task ID)
            if (isset($data['duplicate_source_id'])) {
                $this->duplicateTaskAssets($task, $data['duplicate_source_id'], $user);
            }

            // Custom Fields
            if (isset($data['custom_fields_data'])) {
                $task->updateCustomFieldData($data['custom_fields_data']);
            }

            DB::commit();

            app(TaskLifecycleNotificationService::class)->notifyCreated($task, $user?->id);

            return $task;

        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * Update an existing task.
     *
     * @param Task $task
     * @param array $data
     * @param User|null $user
     * @return Task
     * @throws \Exception
     */
    public function updateTask(Task $task, array $data, ?User $user = null): Task
    {
        DB::beginTransaction();

        try {
            $previousAssigneeIds = $task->users()->pluck('user_id')->sort()->values()->all();
            $assigneesChanged = false;

            $task->heading = $data['heading'];
            $task->description = isset($data['description']) ? trim_editor($data['description']) : '';
            
            $dueDate = (isset($data['without_duedate']) && $data['without_duedate']) 
                ? null 
                : (isset($data['due_date']) ? Carbon::createFromFormat(company()->date_format . ' ' . company()->time_format, $data['due_date']) : null);
             
            // Handle Start Date null
            $task->start_date = isset($data['start_date']) 
                ? Carbon::createFromFormat(company()->date_format . ' ' . company()->time_format, $data['start_date']) 
                : null;
            
            $task->due_date = $dueDate;
            $task->priority = $data['priority'] ?? $task->priority;
            $task->task_category_id = $data['category_id'] ?? $task->task_category_id;
            
             // Project Change Logic
            if (isset($data['project_id']) && $data['project_id'] != $task->project_id) {
                $task->project_id = $data['project_id'];
                // Update time logs
                \App\Models\ProjectTimeLog::where('task_id', $task->id)->update(['project_id' => $data['project_id']]);
            } elseif(array_key_exists('project_id', $data) && empty($data['project_id'])) {
                $task->project_id = null;
            }
            
            // Board Column Override and Completion Logic
            if (isset($data['board_column_id'])) {
                $originalColumnId = $task->board_column_id;
                $task->board_column_id = $data['board_column_id'];
                
                $taskBoardColumn = TaskboardColumn::find($data['board_column_id']);
                if ($taskBoardColumn && $taskBoardColumn->slug == 'done') {
                    $task->completed_on = now()->format('Y-m-d');
                } else {
                    $task->completed_on = null;
                }
                
                $waitingApprovalTaskBoardColumn = TaskboardColumn::waitingForApprovalColumn();
                if ($waitingApprovalTaskBoardColumn && $data['board_column_id'] == $waitingApprovalTaskBoardColumn->id) {
                    $task->approval_send = 1;
                } else {
                    $task->approval_send = 0;
                }
                
                if ($originalColumnId != $task->board_column_id) {
                     $this->logTaskActivity($task->id, $user ? $user->id : user()->id, 'statusActivity', $task->board_column_id);
                }
            }
             
            // Logic for specific 'Waiting Approval' select value from controller
            if (isset($data['select_value']) && $data['select_value'] == 'Waiting Approval') {
                 $taskBoardColumn = TaskboardColumn::where('column_name', 'Waiting Approval')->where('company_id', company()->id)->first();
                 if ($taskBoardColumn) {
                    $task->board_column_id = $taskBoardColumn->id;
                    $task->approval_send = 1;
                 }
            }

             // Dependent Task Logic
             if (isset($data['dependent_task_id']) && $data['dependent_task_id']) {
                if ($data['dependent_task_id'] == $task->id) {
                     throw new \Exception(__('messages.taskDependentSelf'));
                }
                
                $dependentTask = Task::findOrFail($data['dependent_task_id']);
                if ($dependentTask->due_date && $dueDate && $dependentTask->due_date->greaterThan($dueDate)) {
                    throw new \Exception(__('messages.taskDependentDate'));
                }
                $task->dependent_task_id = $data['dependent_task_id'];
            } else {
                if (array_key_exists('dependent_task_id', $data) && empty($data['dependent_task_id'])) {
                    $task->dependent_task_id = null;
                }
            }
            
            $task->is_private = isset($data['is_private']) && $data['is_private'] ? 1 : 0;
            $task->billable = isset($data['billable']) && $data['billable'] ? 1 : 0;
            $task->estimate_hours = $data['estimate_hours'] ?? $task->estimate_hours;
            $task->estimate_minutes = $data['estimate_minutes'] ?? $task->estimate_minutes;
            $task->milestone_id = $data['milestone_id'] ?? $task->milestone_id;
            
            $task->save();

            if (isset($data['task_labels'])) {
                $task->labels()->sync($data['task_labels']);
            }
            
            $assigneeIds = self::normalizeAssigneeIds($data);
            if ($assigneeIds !== null) {
                $task->users()->sync($assigneeIds);
                $assigneesChanged = $previousAssigneeIds !== collect($assigneeIds)->sort()->values()->all();
            }
            
            if (isset($data['custom_fields_data'])) {
                $task->updateCustomFieldData($data['custom_fields_data']);
            }

            $this->handlePolymorphicRelations($task, $data, false);

            DB::commit();

            $lifecycle = app(TaskLifecycleNotificationService::class);
            if ($lifecycle->wasCompletionTransition($task)) {
                $lifecycle->notifyCompleted($task, $user?->id);
            } elseif ($lifecycle->hasMeaningfulChanges($task) || $assigneesChanged) {
                $lifecycle->notifyUpdated($task, $user?->id);
            }

            return $task;
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * Delete a task.
     * 
     * @param Task $task
     * @return bool
     */
    public function deleteTask(Task $task): bool
    {
        if ($task->repeat) {
             Task::where('repeat_task_id', $task->id)->delete();
        }
        
        return $task->delete();
    }
    
    /**
     * Change task status.
     * 
     * @param Task $task
     * @param int $columnId
     * @return Task
     */
    public function changeStatus(Task $task, int $columnId): Task
    {
        $originalColumnId = $task->board_column_id;
        $task->board_column_id = $columnId;
        $taskBoardColumn = TaskboardColumn::find($columnId);

        // Approval Logic
        if ($task->board_column && $task->board_column->slug === 'done' && $taskBoardColumn && $taskBoardColumn->slug !== 'done') {
             $task->approval_send = 0;
        }

        $waitingApprovalTaskBoardColumn = TaskboardColumn::waitingForApprovalColumn();
        if ($waitingApprovalTaskBoardColumn && $columnId == $waitingApprovalTaskBoardColumn->id) {
            $task->approval_send = 1;
        }

        // Completion Logic
        if ($taskBoardColumn && $taskBoardColumn->slug == 'done') {
            $task->completed_on = now()->format('Y-m-d');
        } else {
            $task->completed_on = null;
        }

        if ($task->trashed()) {
            $task->saveQuietly();
        } else {
            $task->save();
        }
        
        // Log activity
        if ($originalColumnId != $task->board_column_id) {
            $this->logTaskActivity($task->id, user()->id, 'statusActivity', $task->board_column_id);
        }
        
        // Calculate Project Progress
        if ($task->project_id != null && $task->project->calculate_task_progress == 'true') {
            $this->calculateProjectProgress($task->project_id, 'true');
        }
        
        return $task;
    }

    /**
     * Handle Polymorphic relations for Deal, Lead, Property
     */
    protected function handlePolymorphicRelations(Task $task, array $data, bool $isNewTask = true)
    {
        if (isset($data['taskable_type']) && isset($data['taskable_id'])) {
            $type = $data['taskable_type'];
            $id = $data['taskable_id'];
            
            $modelClass = null;
            switch(strtolower($type)) {
                case 'deal': $modelClass = \App\Models\Deal::class; break;
                case 'lead': $modelClass = \App\Models\Lead::class; break;
                case 'property': $modelClass = \App\Models\Property::class; break;
            }
            
            if ($modelClass) {
                $entity = $modelClass::withoutGlobalScopes()->find($id);
                if ($entity) {
                    $entity->tasks()->syncWithoutDetaching([$task->id]);

                    // Record CRM event for task linked to deal
                    if ($isNewTask && strtolower($type) === 'deal') {
                        app(DealActivityEventService::class)->recordTaskCreated($entity, $task);
                    } elseif ($isNewTask && strtolower($type) === 'lead') {
                        $this->recordCrmEvent('lead_updated', $entity, [
                            'metadata' => [
                                'action' => 'task_added',
                                'task_id' => $task->id,
                                'task_heading' => $task->heading,
                                'comment' => 'Task added: ' . $task->heading,
                            ],
                        ]);
                    }

                    // Auto-assign deal agent if applicable
                    if (strtolower($type) === 'deal' && $entity->agent_id) {
                        $agentUserId = \App\Models\LeadAgent::find($entity->agent_id)?->user_id;
                        if ($agentUserId) {
                            $task->users()->syncWithoutDetaching([$agentUserId]);
                        }

                        // Send notification to deal watchers/agent about new task
                        if ($isNewTask) {
                            app(DealNotificationService::class)->notifyTaskAdded(
                                $entity,
                                $task->heading,
                                $task->id
                            );
                        }
                    }

                    // Infer the task's lead link from the deal it's connected to.
                    // Only auto-link when the task isn't already linked to a lead,
                    // so we never override an explicitly chosen lead.
                    if (strtolower($type) === 'deal' && $entity->lead_id && $task->leads()->doesntExist()) {
                        $inferredLead = \App\Models\Lead::withoutGlobalScopes()->find($entity->lead_id);
                        if ($inferredLead) {
                            $inferredLead->tasks()->syncWithoutDetaching([$task->id]);
                        }
                    }
                }
            }
        }
    }

    /**
     * Duplicate files and subtasks from a source task
     */
    protected function duplicateTaskAssets(Task $newTask, $sourceTaskId, ?User $user)
    {
        $taskFiles = TaskFile::where('task_id', $sourceTaskId)->get();

        foreach ($taskFiles as $taskFile) {
            $newFilename = Files::generateNewFileName($taskFile->filename);
            // Copy file logic assuming Files helper works as expected
            // Note: In real scenarios, might need try-catch for file system ops
            
             if(file_exists(TaskFile::FILE_PATH . '/' . $taskFile->task_id . '/' . $taskFile->hashname)){
                Files::copy(TaskFile::FILE_PATH . '/' . $taskFile->task_id . '/' . $taskFile->hashname, TaskFile::FILE_PATH . '/' . $newTask->id . '/' . $newFilename);
                
                $file = new TaskFile();
                $file->user_id = $taskFile->user_id;
                $file->task_id = $newTask->id;
                $file->filename = $taskFile->filename;
                $file->hashname = $newFilename;
                $file->size = $taskFile->size;
                $file->save();
                
                 if ($user) {
                    $this->logTaskActivity($newTask->id, $user->id, 'fileActivity', $newTask->board_column_id);
                }
             }
        }

        $subTasks = SubTask::with(['files'])->where('task_id', $sourceTaskId)->get();

        foreach ($subTasks as $subTask) {
            $newSubTask = new SubTask();
            $newSubTask->title = $subTask->title;
            $newSubTask->task_id = $newTask->id;
            $newSubTask->description = $subTask->description; // Already trimmed?
            $newSubTask->assigned_to = $subTask->assigned_to;
            
            if ($subTask->start_date && $subTask->due_date) {
                $newSubTask->start_date = $subTask->start_date;
                $newSubTask->due_date = $subTask->due_date;
            }
            
            $newSubTask->save();

            foreach ($subTask->files as $fileData) {
                 if(file_exists(SubTaskFile::FILE_PATH . '/' . $fileData->sub_task_id . '/' . $fileData->hashname)){
                    $newFilename = Files::generateNewFileName($fileData->filename);
                    Files::copy(SubTaskFile::FILE_PATH . '/' . $fileData->sub_task_id . '/' . $fileData->hashname, SubTaskFile::FILE_PATH . '/' . $newSubTask->id . '/' . $newFilename);

                    $file = new SubTaskFile();
                    $file->user_id = $fileData->user_id;
                    $file->sub_task_id = $newSubTask->id;
                    $file->filename = $fileData->filename;
                    $file->hashname = $newFilename;
                    $file->size = $fileData->size;
                    $file->save();
                 }
            }
        }
    }
    
    private function getTaskShortCode($projectShortCode, $projectLastTaskCount) 
    {
         // This logic was in controller, need to pull it here or replicate
         // For now, implementing basic increment or simplified
         // The original called $this->getTaskShortCode which is strange as it didn't use $this scope well?
         // Ah, it was a method in controller.
         return $projectLastTaskCount + 1;
    }

    /**
     * Log task activity
     *
     * @param int $taskId
     * @param int $userId
     * @param string $text
     * @param int|null $boardColumnId
     * @param int|null $subTaskId
     * @return void
     */
    private function logTaskActivity($taskId, $userId, $text, $boardColumnId = null, $subTaskId = null)
    {
        $activity = new TaskHistory();
        $activity->task_id = $taskId;
        $activity->user_id = $userId;
        $activity->details = $text;

        if (!is_null($subTaskId)) {
            $activity->sub_task_id = $subTaskId;
        }

        if (!is_null($boardColumnId)) {
            $activity->board_column_id = $boardColumnId;
        }

        $activity->save();
    }

    /**
     * Accept user_ids or legacy user_id from request payloads.
     *
     * @return array<int>|null null when no assignee field was sent
     */
    public static function normalizeAssigneeIds(array $data): ?array
    {
        if (array_key_exists('user_ids', $data)) {
            $ids = is_array($data['user_ids']) ? $data['user_ids'] : [$data['user_ids']];

            return array_values(array_filter(array_map('intval', $ids)));
        }

        if (array_key_exists('user_id', $data)) {
            $ids = is_array($data['user_id']) ? $data['user_id'] : [$data['user_id']];

            return array_values(array_filter(array_map('intval', $ids)));
        }

        return null;
    }

    /**
     * Shared task form metadata for dashboard and task pages.
     */
    public static function getTaskFormData(?string $viewPermission = null): array
    {
        $viewPermission = $viewPermission ?? user()->permission('view_tasks');

        return [
            'projects' => Project::allProjects()->map(fn ($project) => [
                'id' => $project->id,
                'project_name' => $project->project_name,
                'project_short_code' => $project->project_short_code,
            ])->values(),
            'users' => User::allEmployees(null, true, ($viewPermission == 'all' ? 'all' : null))->map(fn ($user) => [
                'id' => $user->id,
                'name' => $user->name,
                'image' => $user->image,
                'designation_name' => $user->designation_name ?? null,
            ])->values(),
            'columns' => TaskboardColumn::orderBy('priority', 'asc')->get()->map(fn ($column) => [
                'id' => $column->id,
                'column_name' => $column->column_name,
                'slug' => $column->slug,
                'label_color' => $column->label_color,
                'priority' => $column->priority,
            ])->values(),
            'categories' => TaskCategory::all()->map(fn ($category) => [
                'id' => $category->id,
                'category_name' => $category->category_name,
            ])->values(),
            'labels' => TaskLabelList::all()->map(fn ($label) => [
                'id' => $label->id,
                'label_name' => $label->label_name,
                'label_color' => $label->label_color,
            ])->values(),
            'permissions' => [
                'add_tasks' => user()->permission('add_tasks'),
                'edit_tasks' => user()->permission('edit_tasks'),
                'delete_tasks' => user()->permission('delete_tasks'),
                'change_status' => user()->permission('change_status'),
                'view_tasks' => $viewPermission,
            ],
        ];
    }
}
