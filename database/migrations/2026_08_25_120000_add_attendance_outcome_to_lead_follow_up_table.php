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
        $needsOutcome = !Schema::hasColumn('lead_follow_up', 'attendance_outcome');

        if ($needsOutcome) {
            Schema::table('lead_follow_up', function (Blueprint $table) {
                // Post-meeting attendance outcome (attended/no_show/rescheduled/cancelled/partial).
                // Kept separate from the existing `status` enum (scheduled/completed/cancelled)
                // rather than extending it, to avoid an ALTER on a DB-level enum column.
                //
                // No note column here on purpose: an outcome note is created as a regular
                // DealNote (the existing notes feature) so it shows up in the deal's Notes
                // tab/timeline like any other note, instead of living in a shadow field only
                // visible on the meeting record. See MeetingAttendanceConfirmationService.
                $table->string('attendance_outcome')->nullable()->after('status');
                // NULL = still pending confirmation; non-null = resolved, never prompt again.
                $table->timestamp('attendance_outcome_logged_at')->nullable()->after('attendance_outcome');
                $table->unsignedInteger('attendance_outcome_logged_by')->nullable()->after('attendance_outcome_logged_at');

                $table->foreign('attendance_outcome_logged_by')
                    ->references('id')->on('users')
                    ->onDelete('set null');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $hasOutcome = Schema::hasColumn('lead_follow_up', 'attendance_outcome');

        if ($hasOutcome) {
            Schema::table('lead_follow_up', function (Blueprint $table) {
                $table->dropForeign(['attendance_outcome_logged_by']);
                $table->dropColumn([
                    'attendance_outcome',
                    'attendance_outcome_logged_at',
                    'attendance_outcome_logged_by',
                ]);
            });
        }
    }
};
