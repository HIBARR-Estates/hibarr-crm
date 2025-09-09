<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */

    public function up(): void
    {
        Schema::whenTableHasColumn('sms_notification_settings', 'msg91_flow_id', function (Blueprint $table) {
            $table->dropColumn('msg91_flow_id');
        });

        if (!Schema::hasTable('sms_template_ids')) {
            Schema::create('sms_template_ids', function (Blueprint $table) {
                $table->id();
                $table->string('sms_setting_slug');
                $table->string('msg91_flow_id')->nullable();
                $table->string('whatsapp_template_sid')->nullable();
                $table->timestamps();
            });
        }

    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        //
    }

};
