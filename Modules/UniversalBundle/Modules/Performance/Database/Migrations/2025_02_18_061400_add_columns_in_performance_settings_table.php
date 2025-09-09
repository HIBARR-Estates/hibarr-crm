<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Modules\Performance\Entities\PerformanceSetting;

return new class extends Migration
{

    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('performance_settings', function (Blueprint $table) {
            $table->enum('send_slack_notification', ['yes', 'no'])->default('no')->after('view_meeting_participant');
            $table->enum('send_push_notification', ['yes', 'no'])->default('no')->after('send_slack_notification');
            $table->enum('send_email_notification', ['yes', 'no'])->default('no')->after('send_push_notification');
        });

        $performanceSettings = PerformanceSetting::all();

        foreach ($performanceSettings as $setting) {
            if ($setting->send_notification == 'yes') {
                $setting->send_email_notification = 'yes';
                $setting->save();
            }
        }

        Schema::table('performance_settings', function (Blueprint $table) {
            $table->dropColumn('send_notification');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('performance_settings', function (Blueprint $table) {
            $table->dropColumn('send_slack_notification');
            $table->dropColumn('send_push_notification');
            $table->dropColumn('send_email_notification');
        });

        $performanceSettings = PerformanceSetting::all();

        foreach ($performanceSettings as $setting) {
            if ($setting->send_email_notification == 'yes') {
                $setting->send_notification = 'yes';
                $setting->save();
            }
        }

        Schema::table('performance_settings', function (Blueprint $table) {
            $table->enum('send_notification', ['yes', 'no'])->default('no')->after('company_id');
        });
    }

};
