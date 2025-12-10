<?php

namespace App\Services;

use App\Models\Deal;
use App\Models\Task;
use App\Models\TaskboardColumn;
use App\Models\User;
use Carbon\Carbon;

class DealTaskService
{
    public function createDefaultTasks(Deal $deal)
    {
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

        // Define default tasks
        $tasksToCreate = [
            [
                'heading' => 'Schedule a meeting with client',
                'description' => 'Schedule an initial meeting with the client for deal: ' . $deal->name,
                'priority' => 'high',
            ],
            [
                'heading' => 'Send property details',
                'description' => 'Send details of the property to the client.',
                'priority' => 'medium',
            ],
            [
                'heading' => 'Set up a deal watcher',
                'description' => 'Add relevant watchers to this deal.',
                'priority' => 'medium',
            ]
        ];

        // Add "Assign Deal Agent" task if no agent is assigned
        if (is_null($deal->agent_id)) {
            $tasksToCreate[] = [
                'heading' => 'Assign Deal Agent',
                'description' => 'Assign an agent to this deal.',
                'priority' => 'high',
            ];
        }

        foreach ($tasksToCreate as $taskData) {
            $this->createTask($deal, $taskData, $columnId);
        }
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
        
        // If deal has an agent, assign the task to them? 
        // The prompt doesn't explicitly say to assign the task to the deal agent, 
        // but it makes sense. However, I'll stick to creating the task first.
        // If I assign it to the agent, I need to populate task_users table.
        
        $task->save();

        // Associate with Deal
        // Using the morphToMany relationship defined in Deal model
        $deal->tasks()->attach($task->id);

        // If deal has an agent (LeadAgent), we might want to assign the task to the corresponding User.
        // LeadAgent model usually links to a User.
        if ($deal->leadAgent && $deal->leadAgent->user_id) {
            $task->users()->attach($deal->leadAgent->user_id);
        }
    }
}
