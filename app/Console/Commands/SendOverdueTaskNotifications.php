<?php

namespace App\Console\Commands;

use App\Models\Company;
use App\Services\TaskNotificationService;
use Illuminate\Console\Command;

class SendOverdueTaskNotifications extends Command
{
    protected $signature = 'send-overdue-task-notifications';

    protected $description = 'Notify task assignees and managers about overdue tasks';

    public function handle(TaskNotificationService $taskNotificationService): int
    {
        Company::active()->chunk(50, function ($companies) use ($taskNotificationService) {
            foreach ($companies as $company) {
                $overdueTasks = $taskNotificationService->overdueTasksForCompany((int) $company->id);

                foreach ($overdueTasks as $task) {
                    try {
                        $taskNotificationService->notifyOverdue($task);
                    } catch (\Throwable $e) {
                        \Log::error('Failed to send overdue task notification', [
                            'task_id' => $task->id,
                            'company_id' => $company->id,
                            'exception' => $e::class,
                        ]);
                    }
                }
            }
        });

        return Command::SUCCESS;
    }
}
