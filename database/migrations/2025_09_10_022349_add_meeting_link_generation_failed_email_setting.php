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
        // Add email notification setting for meeting link generation failures
        \DB::table('email_notification_settings')->insert([
            'setting_name' => 'Meeting Link Generation Failed',
            'send_email' => 'yes',
            'send_push' => 'no',
            'send_slack' => 'no',
            'slug' => 'meeting-link-generation-failed',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Remove the email notification setting
        \DB::table('email_notification_settings')
            ->where('slug', 'meeting-link-generation-failed')
            ->delete();
    }
};
