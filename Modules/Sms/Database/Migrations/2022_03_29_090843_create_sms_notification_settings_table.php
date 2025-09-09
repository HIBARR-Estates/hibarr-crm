<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::create('sms_notification_settings', function (Blueprint $table) {
            $table->id();
            $table->string('setting_name');
            $table->string('slug')->nullable();
            $table->enum('send_sms', ['yes', 'no'])->default('no');
            $table->longText('whatsapp_template')->nullable();
            $table->longText('msg91_template')->nullable();
            $table->string('msg91_flow_id')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('sms_notification_settings');
    }
};
