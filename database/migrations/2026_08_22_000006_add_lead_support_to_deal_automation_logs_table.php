<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Guarded step-by-step: MySQL DDL auto-commits per statement, so a
        // failure partway through a prior run of this migration can leave
        // some of these already applied without the migration being marked
        // as run. Each step checks before applying so a retry is safe.
        $existingForeignKeys = $this->existingForeignKeyColumns();

        if (! in_array('deal_id', $existingForeignKeys)) {
            Schema::table('deal_automation_logs', function (Blueprint $table) {
                $table->unsignedBigInteger('deal_id')->nullable()->change();
                $table->foreign('deal_id')->references('id')->on('deals')->onDelete('cascade');
            });
        }

        // leads.id is a plain unsignedInteger (increments()), not bigint — must match.
        if (! Schema::hasColumn('deal_automation_logs', 'lead_id')) {
            Schema::table('deal_automation_logs', function (Blueprint $table) {
                $table->unsignedInteger('lead_id')->nullable()->after('deal_id');
            });
        } else {
            // Normalize in case an earlier partial run added it as bigint.
            Schema::table('deal_automation_logs', function (Blueprint $table) {
                $table->unsignedInteger('lead_id')->nullable()->change();
            });
        }

        $existingForeignKeys = $this->existingForeignKeyColumns();

        if (! in_array('lead_id', $existingForeignKeys)) {
            Schema::table('deal_automation_logs', function (Blueprint $table) {
                $table->foreign('lead_id')->references('id')->on('leads')->onDelete('cascade');
            });
        }

        if (! $this->hasIndex('deal_automation_logs', 'deal_automation_logs_lead_id_automation_id_index')) {
            Schema::table('deal_automation_logs', function (Blueprint $table) {
                $table->index(['lead_id', 'automation_id']);
            });
        }
    }

    public function down(): void
    {
        Schema::table('deal_automation_logs', function (Blueprint $table) {
            $table->dropForeign(['lead_id']);
            $table->dropIndex(['lead_id', 'automation_id']);
            $table->dropColumn('lead_id');

            $table->dropForeign(['deal_id']);
            $table->unsignedBigInteger('deal_id')->nullable(false)->change();
            $table->foreign('deal_id')->references('id')->on('deals')->onDelete('cascade');
        });
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

    protected function hasIndex(string $table, string $indexName): bool
    {
        return collect(DB::select('
            SELECT 1 FROM information_schema.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?
        ', [$table, $indexName]))->isNotEmpty();
    }
};
