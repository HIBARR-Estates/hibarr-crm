<?php

namespace App\Services;

use App\Models\Deal;
use App\Models\Task;
use App\Models\TaskboardColumn;
use App\Models\User;
use App\Services\Reminders\TaskReminderSync;
use App\Traits\RecordsCrmEvents;
use Carbon\Carbon;

class DealTaskService
{
    use RecordsCrmEvents;
    // Define task types
    public const TASK_SCHEDULE_MEETING = 'schedule_meeting';
    public const TASK_SEND_PROPERTY_DETAILS = 'send_property_details';
    public const TASK_SETUP_WATCHER = 'setup_watcher';
    public const TASK_ASSIGN_AGENT = 'assign_agent';

    public function getAvailableDefaultTasks()
    {
        return [
            self::TASK_SCHEDULE_MEETING => [
                'heading' => 'Schedule a meeting with client',
                'description' => 'Schedule an initial meeting with the client.',
                'priority' => 'high',
                'label' => 'Schedule Meeting',
            ],
            self::TASK_SEND_PROPERTY_DETAILS => [
                'heading' => 'Send property details',
                'description' => 'Send details of the property to the client.',
                'priority' => 'medium',
                'label' => 'Send Property Details',
            ],
            // self::TASK_SETUP_WATCHER => [
            //     'heading' => 'Set up a deal watcher',
            //     'description' => 'Add relevant watchers to this deal.',
            //     'priority' => 'medium',
            //     'label' => 'Set Up Watcher',
            // ],
            // self::TASK_ASSIGN_AGENT => [
            //     'heading' => 'Assign Deal Agent',
            //     'description' => 'Assign an agent to this deal.',
            //     'priority' => 'high',
            //     'label' => 'Assign Agent',
            // ],
        ];
    }

    public function createDefaultTasks(Deal $deal)
    {
        $tasks = $this->getAvailableDefaultTasks();

        foreach ($tasks as $key => $taskData) {
            // Skip assign agent if already assigned
            if ($key === self::TASK_ASSIGN_AGENT && !is_null($deal->agent_id)) {
                continue;
            }
            $this->createTaskByType($deal, $key);
        }
    }

    public function createTaskByType(Deal $deal, string $type)
    {
        $tasks = $this->getAvailableDefaultTasks();

        if (!isset($tasks[$type])) {
            return null;
        }

        $taskData = $tasks[$type];
        
        // Dynamic description for meeting
        if ($type === self::TASK_SCHEDULE_MEETING) {
            $taskData['description'] .= ' for deal: ' . $deal->name;
        }

        $companyId = $deal->company_id;
        
        // Get the default task board column (usually 'incomplete')
        $defaultColumn = TaskboardColumn::where('slug', 'incomplete')
            ->where('company_id', $companyId)
            ->first();

        if (!$defaultColumn) {
            // Fallback to the first column if 'incomplete' not found
            $defaultColumn = TaskboardColumn::where('company_id', $companyId)
                ->orderBy('priority')
                ->first();
        }

        $columnId = $defaultColumn ? $defaultColumn->id : null;

        return $this->createTask($deal, $taskData, $columnId);
    }

    private function createTask(Deal $deal, array $taskData, ?int $columnId)
    {
        $task = new Task();
        $task->company_id = $deal->company_id;
        $task->heading = $taskData['heading'];
        $task->description = $taskData['description'];
        $task->priority = $taskData['priority'];
        $task->start_date = Carbon::now();
        $task->due_date = Carbon::now()->addDays(3); // Default due date 3 days from now
        $task->board_column_id = $columnId;
        $task->status = 'incomplete';
        $task->is_private = 0;
        $task->billable = 0;
        $task->added_by = user() ? user()->id : null;
        
        $task->save();

        // Associate with Deal
        // Using the morphToMany relationship defined in Deal model
        $deal->tasks()->attach($task->id);

        // Record CRM event for deal task creation
        app(DealActivityEventService::class)->recordTaskCreated($deal, $task);

        // If deal has an agent (LeadAgent), we might want to assign the task to the corresponding User.
        // LeadAgent model usually links to a User.
        if ($deal->leadAgent && $deal->leadAgent->user_id) {
            $task->users()->attach($deal->leadAgent->user_id);
        }

        app(TaskReminderSync::class)->syncFromTask($task->fresh(['users', 'boardColumn', 'createBy', 'addedByUser']));

        return $task;
    }
}
