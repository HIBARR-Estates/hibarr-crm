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
        $needsColumn = !Schema::hasColumn('companies', 'meeting_attendance_confirmation_enabled_at');

        if ($needsColumn) {
            Schema::table('companies', function (Blueprint $table) {
                // Stamped once, lazily, the first time the meeting-attendance-confirmation
                // feature is observed enabled for this company. Meetings that ended before
                // this timestamp are never eligible for the confirmation prompt, even after
                // the feature flag is on — this is the non-retroactivity cutoff.
                $table->timestamp('meeting_attendance_confirmation_enabled_at')->nullable();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $hasColumn = Schema::hasColumn('companies', 'meeting_attendance_confirmation_enabled_at');

        if ($hasColumn) {
            Schema::table('companies', function (Blueprint $table) {
                $table->dropColumn('meeting_attendance_confirmation_enabled_at');
            });
        }
    }
};
