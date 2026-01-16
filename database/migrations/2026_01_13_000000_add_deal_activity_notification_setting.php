<?php

use App\Models\Company;
use App\Models\EmailNotificationSetting;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * Adds the 'deal-activity-notification' email setting to all existing companies
     * so they can receive email notifications for deal activities (notes, stage changes,
     * tasks, meetings, files, packages).
     */
    public function up(): void
    {
        $companies = Company::select('id')->get();

        foreach ($companies as $company) {
            // Check if setting already exists for this company
            $exists = EmailNotificationSetting::where('company_id', $company->id)
                ->where('slug', 'deal-activity-notification')
                ->exists();

            if (!$exists) {
                EmailNotificationSetting::create([
                    'company_id' => $company->id,
                    'setting_name' => 'Deal Activity Notification',
                    'slug' => 'deal-activity-notification',
                    'send_email' => 'yes',
                    'send_push' => 'no',
                    'send_slack' => 'no',
                ]);
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        EmailNotificationSetting::where('slug', 'deal-activity-notification')->delete();
    }
};
