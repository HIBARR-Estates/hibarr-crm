<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * One automation execution writes one log row per action it performs, so a
 * two-action automation looked like two runs everywhere runs were counted.
 * `run_id` is stamped once per execution and shared by every step of it, so
 * "runs" can mean executions and the history can nest steps under the run
 * they belong to.
 *
 * It also lands on deal_automation_pending_runs: a "wait" action step splits
 * one execution across two passes (before the wait, and after it resumes), and
 * carrying the id on the pending row keeps both halves in the same run.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('deal_automation_logs', 'run_id')) {
            Schema::table('deal_automation_logs', function (Blueprint $table) {
                $table->char('run_id', 36)->nullable()->after('automation_id');
                $table->index('run_id');
            });
        }

        // Rows written before this column existed have no grouping to recover —
        // each was recorded as a standalone step, so each becomes its own
        // single-step run. Giving them an id (rather than leaving null) means
        // every query downstream can just group by run_id.
        DB::table('deal_automation_logs')
            ->whereNull('run_id')
            ->orderBy('id')
            ->chunkById(500, function ($rows) {
                foreach ($rows as $row) {
                    DB::table('deal_automation_logs')
                        ->where('id', $row->id)
                        ->update(['run_id' => (string) Str::uuid()]);
                }
            });

        if (! Schema::hasColumn('deal_automation_pending_runs', 'run_id')) {
            Schema::table('deal_automation_pending_runs', function (Blueprint $table) {
                $table->char('run_id', 36)->nullable()->after('resume_action_id');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('deal_automation_logs', 'run_id')) {
            Schema::table('deal_automation_logs', function (Blueprint $table) {
                $table->dropIndex(['run_id']);
                $table->dropColumn('run_id');
            });
        }

        if (Schema::hasColumn('deal_automation_pending_runs', 'run_id')) {
            Schema::table('deal_automation_pending_runs', function (Blueprint $table) {
                $table->dropColumn('run_id');
            });
        }
    }
};
