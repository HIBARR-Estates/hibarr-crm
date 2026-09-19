<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Two changes so the run history can answer "why did this fail?":
 *  - `details` holds the structured diagnostic payload (per-recipient mail
 *    system + error, or Meta's raw API response).
 *  - `automation_id` becomes nullable so a Meta conversion fired by a
 *    pipeline-stage trigger (DealObserver, no automation involved) can be
 *    logged in the same place as an automation-fired one.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('deal_automation_logs', 'details')) {
            Schema::table('deal_automation_logs', function (Blueprint $table) {
                $table->json('details')->nullable()->after('channel');
            });
        }

        // Drop/recreate around the change() because the FK blocks a column
        // modification on MySQL. Guarded so a partial prior run can retry.
        $foreignKeys = $this->existingForeignKeyColumns();

        if (in_array('automation_id', $foreignKeys, true)) {
            Schema::table('deal_automation_logs', function (Blueprint $table) {
                $table->dropForeign(['automation_id']);
            });
        }

        Schema::table('deal_automation_logs', function (Blueprint $table) {
            $table->unsignedBigInteger('automation_id')->nullable()->change();
        });

        if (! in_array('automation_id', $this->existingForeignKeyColumns(), true)) {
            Schema::table('deal_automation_logs', function (Blueprint $table) {
                $table->foreign('automation_id')->references('id')->on('deal_automations')->onDelete('cascade');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('deal_automation_logs', 'details')) {
            Schema::table('deal_automation_logs', function (Blueprint $table) {
                $table->dropColumn('details');
            });
        }

        // Rows with no automation can't satisfy the NOT NULL constraint.
        DB::table('deal_automation_logs')->whereNull('automation_id')->delete();

        // Same guard as up(): the FK may already be gone if a prior run of
        // either direction stopped partway (MySQL auto-commits per DDL
        // statement), and dropping a missing FK aborts the rollback.
        if (in_array('automation_id', $this->existingForeignKeyColumns(), true)) {
            Schema::table('deal_automation_logs', function (Blueprint $table) {
                $table->dropForeign(['automation_id']);
            });
        }

        Schema::table('deal_automation_logs', function (Blueprint $table) {
            $table->unsignedBigInteger('automation_id')->nullable(false)->change();
        });

        if (! in_array('automation_id', $this->existingForeignKeyColumns(), true)) {
            Schema::table('deal_automation_logs', function (Blueprint $table) {
                $table->foreign('automation_id')->references('id')->on('deal_automations')->onDelete('cascade');
            });
        }
    }

    /**
     * @return array<int, string>
     */
    protected function existingForeignKeyColumns(): array
    {
        return collect(DB::select("
            SELECT COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'deal_automation_logs'
              AND REFERENCED_TABLE_NAME IS NOT NULL
        "))->pluck('COLUMN_NAME')->all();
    }
};
