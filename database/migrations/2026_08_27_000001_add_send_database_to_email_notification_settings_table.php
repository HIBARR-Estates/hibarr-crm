<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('email_notification_settings', 'send_database')) {
            Schema::table('email_notification_settings', function (Blueprint $table) {
                $table->enum('send_database', ['yes', 'no'])->default('yes')->after('send_push');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('email_notification_settings', 'send_database')) {
            Schema::table('email_notification_settings', function (Blueprint $table) {
                $table->dropColumn('send_database');
            });
        }
    }
};
