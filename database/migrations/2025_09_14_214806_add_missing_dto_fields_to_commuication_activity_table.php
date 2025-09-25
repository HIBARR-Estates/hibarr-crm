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
        Schema::table('communication_activities', function (Blueprint $table) {
            //
            // email, phone_number, instagram_username, telegram_username, first_name, last_name, message_type, subject
            $table->string('email')->nullable();
            $table->string('phone_number')->nullable();
            $table->string('instagram_username')->nullable();
            $table->string('telegram_username')->nullable();
            $table->string('first_name')->nullable();
            $table->string('last_name')->nullable();
            $table->string('message_type')->nullable();
            $table->string('subject')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('communication_activities', function (Blueprint $table) {
            //
            $table->dropColumn(['email', 'phone_number', 'instagram_username', 'telegram_username', 'first_name', 'last_name', 'message_type', 'subject']); 
        });
    }
};
