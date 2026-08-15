<?php

use App\Models\Company;
use App\Models\EmailNotificationSetting;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    /**
     * Admin toggles for task lifecycle gap notifications.
     */
    public function up(): void
    {
        $definitions = [
            ['setting_name' => 'Task Deleted', 'slug' => 'task-deleted'],
            ['setting_name' => 'Task Rejected From Review', 'slug' => 'task-rejected'],
            ['setting_name' => 'Task Overdue', 'slug' => 'task-overdue'],
            ['setting_name' => 'Task Priority Changed', 'slug' => 'task-priority-updated'],
            ['setting_name' => 'Sub Task Created', 'slug' => 'sub-task-created'],
        ];

        Company::query()->select('id')->each(function (Company $company) use ($definitions) {
            $reference = EmailNotificationSetting::query()
                ->where('company_id', $company->id)
                ->where('slug', 'task-status-updated')
                ->first();

            foreach ($definitions as $definition) {
                $exists = EmailNotificationSetting::query()
                    ->where('company_id', $company->id)
                    ->where('slug', $definition['slug'])
                    ->exists();

                if ($exists) {
                    continue;
                }

                EmailNotificationSetting::create([
                    'company_id' => $company->id,
                    'setting_name' => $definition['setting_name'],
                    'slug' => $definition['slug'],
                    'send_email' => $reference?->send_email ?? 'yes',
                    'send_push' => $reference?->send_push ?? 'no',
                    'send_slack' => $reference?->send_slack ?? 'no',
                ]);
            }
        });
    }

    public function down(): void
    {
        // Non-destructive rollback: settings may pre-exist or be tenant-managed.
    }
};
