<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Per-company overrides for the meeting-attendance-confirmation prompt's
     * delay and snooze durations. Null means "use the config default"
     * (config/meetings.php). Enablement itself stays governed by the
     * crm.meeting-attendance-confirmation remote flag alone — no per-company
     * toggle.
     */
    public function up(): void
    {
        Schema::table('companies', function (Blueprint $table) {
            if (!Schema::hasColumn('companies', 'meeting_attendance_confirmation_delay_minutes')) {
                $table->unsignedInteger('meeting_attendance_confirmation_delay_minutes')->nullable()
                    ->after('meeting_attendance_confirmation_enabled_at');
            }
            if (!Schema::hasColumn('companies', 'meeting_attendance_confirmation_snooze_minutes')) {
                $table->unsignedInteger('meeting_attendance_confirmation_snooze_minutes')->nullable()
                    ->after('meeting_attendance_confirmation_delay_minutes');
            }
        });
    }

    public function down(): void
    {
        Schema::table('companies', function (Blueprint $table) {
            foreach ([
                'meeting_attendance_confirmation_delay_minutes',
                'meeting_attendance_confirmation_snooze_minutes',
            ] as $column) {
                if (Schema::hasColumn('companies', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
