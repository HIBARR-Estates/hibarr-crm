<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('lead_follow_up', 'zoho_calendar_sync_error')) {
            return;
        }

        Schema::table('lead_follow_up', function (Blueprint $table) {
            // Why the last OL sync attempt failed (OL's own message), so the
            // meeting dialog can show it next to "Retry sync". Cleared on success.
            $table->text('zoho_calendar_sync_error')->nullable()->after('zoho_calendar_event_uid');
        });
    }

    public function down(): void
    {
        if (! Schema::hasColumn('lead_follow_up', 'zoho_calendar_sync_error')) {
            return;
        }

        Schema::table('lead_follow_up', function (Blueprint $table) {
            $table->dropColumn('zoho_calendar_sync_error');
        });
    }
};
