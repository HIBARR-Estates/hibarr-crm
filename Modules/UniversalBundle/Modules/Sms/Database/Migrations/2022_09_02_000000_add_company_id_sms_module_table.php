<?php

use App\Models\Company;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Modules\Sms\Entities\SmsNotificationSetting;
use Modules\Sms\Entities\SmsSetting;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {

        \App\Models\Module::validateVersion(SmsSetting::MODULE_NAME);

        $tables = ['sms_notification_settings'];

        $count = Company::count();

        try {

            foreach ($tables as $table) {

                if (! Schema::hasColumn($table, 'company_id')) {
                    Schema::table($table, function (Blueprint $table) {
                        $table->integer('company_id')->unsigned()->nullable()->after('id');
                        $table->foreign('company_id')->references('id')
                            ->on('companies')->onDelete('cascade')->onUpdate('cascade');
                    });
                }

                if (Schema::hasColumn($table, 'company_id') && $count === 1) {
                    DB::table($table)->update(['company_id' => 1]);
                }
            }

        } catch (Exception $e) {
            // None
        }

        $companies = Company::all();

        // We will insert these for the new company from event listener
        foreach ($companies as $company) {
            SmsSetting::addModuleSetting($company);
        }

        $global = [
            'name' => 'Test Sms Notification',
            'send_sms' => 'yes',
        ];

        $companyId = null;

        if (isWorksuite())
        {
            $companyId = Company::first()?->id;
        }

        SmsNotificationSetting::firstOrCreate([
            'company_id' => $companyId,
            'setting_name' => $global['name'],
            'slug' => str_slug($global['name']),
            'send_sms' => $global['send_sms'],
        ]);
    }
};
