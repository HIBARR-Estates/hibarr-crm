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
        if (!Schema::hasColumn('lead_follow_up', 'attendance_confirmation_snoozed_until')) {
            Schema::table('lead_follow_up', function (Blueprint $table) {
                // NULL or in the past = not snoozed / snooze has elapsed, so the
                // meeting is eligible again. Future timestamp = hidden from the
                // reminders dock until then. See MeetingAttendanceConfirmationService.
                $table->timestamp('attendance_confirmation_snoozed_until')->nullable()->after('attendance_outcome_logged_by');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasColumn('lead_follow_up', 'attendance_confirmation_snoozed_until')) {
            Schema::table('lead_follow_up', function (Blueprint $table) {
                $table->dropColumn('attendance_confirmation_snoozed_until');
            });
        }
    }
};
