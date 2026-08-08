<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('lead_follow_up', 'zoho_calendar_event_uid')) {
            return;
        }

        Schema::table('lead_follow_up', function (Blueprint $table) {
            $table->string('zoho_calendar_event_uid')->nullable()->after('zoho_calendar_sync_status');
        });
    }

    public function down(): void
    {
        if (!Schema::hasColumn('lead_follow_up', 'zoho_calendar_event_uid')) {
            return;
        }

        Schema::table('lead_follow_up', function (Blueprint $table) {
            $table->dropColumn('zoho_calendar_event_uid');
        });
    }
};
