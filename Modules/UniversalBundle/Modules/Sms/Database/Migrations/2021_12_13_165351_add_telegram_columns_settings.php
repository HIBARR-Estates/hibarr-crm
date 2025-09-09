<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::table('sms_settings', function (Blueprint $table) {
            $table->boolean('telegram_status')->default(0);
            $table->string('telegram_bot_token')->nullable();
        });

        Schema::table('users', function (Blueprint $table) {
            $table->bigInteger('telegram_user_id')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::table('sms_settings', function (Blueprint $table) {
            $table->dropColumn(['telegram_status']);
            $table->dropColumn(['telegram_bot_token']);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['telegram_user_id']);
        });
    }
};
