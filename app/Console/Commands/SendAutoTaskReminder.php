<?php

namespace App\Console\Commands;

use App\Events\AutoTaskReminderEvent;
use App\Models\Company;
use App\Models\Task;
use App\Models\TaskboardColumn;
use Illuminate\Console\Command;

class SendAutoTaskReminder extends Command
{

    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'send-auto-task-reminder';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Send task reminders';

    /**
     * Execute the console command.
     *
     * @return mixed
     */

    public function handle()
    {

        Company::active()->select(['id', 'before_days', 'after_days', 'on_deadline', 'timezone'])->chunk(50, function ($companies) {

            foreach ($companies as $company) {

                $now = now($company->timezone);

                $completedTaskColumn = TaskboardColumn::where('company_id', $company->id)
                    ->where('slug', 'completed')
                    ->first();

                if (!$completedTaskColumn) {
                    continue;
                }

                if ($company->before_days > 0) {
                    $beforeDeadline = $now->clone()->addDays($company->before_days)->format('Y-m-d');
                    $this->dispatchReminders($beforeDeadline, $company->id, $completedTaskColumn->id);
                }

                if ($company->on_deadline === 'yes') {
                    $onDeadline = $now->clone()->format('Y-m-d');
                    $this->dispatchReminders($onDeadline, $company->id, $completedTaskColumn->id);
                }

                if ($company->after_days > 0) {
                    $afterDeadline = $now->clone()->subDays($company->after_days)->format('Y-m-d');
                    $this->dispatchReminders($afterDeadline, $company->id, $completedTaskColumn->id);
                }
            }
        });

        return Command::SUCCESS;

    }

    private function dispatchReminders(string $dueDate, int $companyId, int $completedColumnId): void
    {
        $tasks = Task::whereDate('due_date', $dueDate)
            ->where('company_id', $companyId)
            ->where('board_column_id', '<>', $completedColumnId)
            ->get();

        foreach ($tasks as $task) {
            event(new AutoTaskReminderEvent($task));
        }
    }

}
