<?php

use App\Models\Company;
use App\Models\EmailNotificationSetting;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    /**
     * Separate admin toggles for deal package vs property activity emails.
     */
    public function up(): void
    {
        $definitions = [
            [
                'setting_name' => 'Deal Package Notification',
                'slug' => 'deal-package-notification',
            ],
            [
                'setting_name' => 'Deal Property Notification',
                'slug' => 'deal-property-notification',
            ],
        ];

        Company::query()->select('id')->each(function (Company $company) use ($definitions) {
            $dealActivity = EmailNotificationSetting::query()
                ->where('company_id', $company->id)
                ->where('slug', 'deal-activity-notification')
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
                    'send_email' => $dealActivity?->send_email ?? 'yes',
                    'send_push' => 'no',
                    'send_slack' => 'no',
                ]);
            }
        });
    }

    public function down(): void
    {
        // Non-destructive rollback: settings may pre-exist or be tenant-managed.
    }
};
