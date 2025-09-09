<?php

use App\Models\Company;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Modules\Sms\Entities\SmsNotificationSetting;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        if (Schema::hasColumn('sms_notification_settings', 'whatsapp_template')) {
            Schema::table('sms_notification_settings', function (Blueprint $table) {
                $table->dropColumn('whatsapp_template');
                $table->dropColumn('msg91_template');
            });
        }

        if (SmsNotificationSetting::withoutGlobalScopes()->count()) {
            Company::get()->each(function ($company) {

                $setting = SmsNotificationSetting::withoutGlobalScope(CompanyScope::class)->firstOrNew([
                    'company_id' => $company->id,
                    'setting_name' => __('modules.emailNotification.two-factor-code'),
                    'slug' => 'two-factor-code',
                    'send_sms' => 'no',
                ]);
                $setting->saveQuietly();

                $setting = SmsNotificationSetting::withoutGlobalScope(CompanyScope::class)->firstOrNew([
                    'company_id' => $company->id,
                    'setting_name' => __('modules.emailNotification.removal-request-reject-user'),
                    'slug' => 'removal-request-reject-user',
                    'send_sms' => 'no',
                ]);

                $setting->saveQuietly();

                $setting = SmsNotificationSetting::withoutGlobalScope(CompanyScope::class)->firstOrNew([
                    'company_id' => $company->id,
                    'setting_name' => __('modules.emailNotification.removal-request-approved-user'),
                    'slug' => 'removal-request-approved-user',
                    'send_sms' => 'no',
                ]);

                $setting->saveQuietly();
            });
        }

    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        //
    }
};
