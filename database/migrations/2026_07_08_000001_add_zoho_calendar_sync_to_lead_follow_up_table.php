<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $needsJobId = !Schema::hasColumn('lead_follow_up', 'zoho_calendar_job_id');
        $needsStatus = !Schema::hasColumn('lead_follow_up', 'zoho_calendar_sync_status');

        if (!$needsJobId && !$needsStatus) {
            return;
        }

        Schema::table('lead_follow_up', function (Blueprint $table) use ($needsJobId, $needsStatus) {
            if ($needsJobId) {
                $table->string('zoho_calendar_job_id')->nullable()->after('meeting_id');
            }

            if ($needsStatus) {
                $table->string('zoho_calendar_sync_status')->nullable()->after('zoho_calendar_job_id');
            }
        });
    }

    public function down(): void
    {
        $hasJobId = Schema::hasColumn('lead_follow_up', 'zoho_calendar_job_id');
        $hasStatus = Schema::hasColumn('lead_follow_up', 'zoho_calendar_sync_status');

        if (!$hasJobId && !$hasStatus) {
            return;
        }

        if ($hasStatus) {
            Schema::table('lead_follow_up', function (Blueprint $table) {
                $table->dropColumn('zoho_calendar_sync_status');
            });
        }

        if ($hasJobId) {
            Schema::table('lead_follow_up', function (Blueprint $table) {
                $table->dropColumn('zoho_calendar_job_id');
            });
        }
    }
};

