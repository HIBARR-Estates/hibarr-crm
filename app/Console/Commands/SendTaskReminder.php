<?php

namespace App\Console\Commands;

use App\Events\TaskReminderEvent;
use App\Models\Company;
use App\Models\Task;
use App\Models\TaskboardColumn;
use App\Support\ReminderFeature;
use Illuminate\Console\Command;

class SendTaskReminder extends Command
{

    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'send-task-reminder';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Send task reminders';

    /**
     *
     */
    public function handle()
    {
        Company::active()->select(['id', 'timezone', 'before_days', 'after_days', 'on_deadline'])->chunk(50, function ($companies) {
            foreach ($companies as $company) {
                if (ReminderFeature::enabledForCompany($company)) {
                    continue;
                }

                $now = now($company->timezone);

                $completedTaskColumn = TaskboardColumn::where('company_id', $company->id)
                    ->where('slug', 'done')
                    ->first();

                if (!$completedTaskColumn) {
                    continue;
                }

                if ($company->before_days > 0) {
                    $beforeDeadline = $now->clone()->addDays($company->before_days)->format('Y-m-d');
                    $this->sendReminders($beforeDeadline, $company, $completedTaskColumn->id);
                }

                if ($company->on_deadline === 'yes') {
                    $onDeadline = $now->clone()->format('Y-m-d');
                    $this->sendReminders($onDeadline, $company, $completedTaskColumn->id);
                }

                if ($company->after_days > 0) {
                    $afterDeadline = $now->clone()->subDays($company->after_days)->format('Y-m-d');
                    $this->sendReminders($afterDeadline, $company, $completedTaskColumn->id);
                }
            }
        });

        return Command::SUCCESS;
    }

    /**
     * Send task reminders for the given date and company.
     */
    private function sendReminders(string $dueDate, Company $company, int $completedColumnId): void
    {
        $tasks = Task::whereDate('due_date', $dueDate)
            ->where('company_id', $company->id)
            ->where('board_column_id', '<>', $completedColumnId)
            ->get();

        foreach ($tasks as $task) {
            event(new TaskReminderEvent($task));
        }
    }

}
