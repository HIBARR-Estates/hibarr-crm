<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('leads')) {
            return;
        }

        if (!Schema::hasColumn('leads', 'deleted_at')) {
            Schema::table('leads', function (Blueprint $table) {
                $table->softDeletes();
            });
        }

        if (!Schema::hasColumn('leads', 'merged_into_lead_id')) {
            Schema::table('leads', function (Blueprint $table) {
                $table->unsignedInteger('merged_into_lead_id')->nullable()->after('deleted_at');
                $table->index('merged_into_lead_id', 'leads_merged_into_lead_id_index');
            });
        }

        if (
            Schema::hasColumn('leads', 'merged_into_lead_id')
            && !$this->foreignKeyExists('leads', 'leads_merged_into_lead_id_foreign')
        ) {
            Schema::table('leads', function (Blueprint $table) {
                $table->foreign('merged_into_lead_id', 'leads_merged_into_lead_id_foreign')
                    ->references('id')
                    ->on('leads')
                    ->onUpdate('cascade')
                    ->onDelete('set null');
            });
        }
    }

    public function down(): void
    {
        if (!Schema::hasTable('leads')) {
            return;
        }

        if (
            Schema::hasColumn('leads', 'merged_into_lead_id')
            && $this->foreignKeyExists('leads', 'leads_merged_into_lead_id_foreign')
        ) {
            Schema::table('leads', function (Blueprint $table) {
                $table->dropForeign('leads_merged_into_lead_id_foreign');
            });
        }

        if (Schema::hasColumn('leads', 'merged_into_lead_id')) {
            Schema::table('leads', function (Blueprint $table) {
                $table->dropIndex('leads_merged_into_lead_id_index');
                $table->dropColumn('merged_into_lead_id');
            });
        }

        if (Schema::hasColumn('leads', 'deleted_at')) {
            Schema::table('leads', function (Blueprint $table) {
                $table->dropSoftDeletes();
            });
        }
    }

    private function foreignKeyExists(string $table, string $foreignKey): bool
    {
        $connection = Schema::getConnection();

        if ($connection->getDriverName() === 'sqlite') {
            return false;
        }

        $database = $connection->getDatabaseName();

        $result = $connection->selectOne(
            'SELECT COUNT(*) AS count FROM information_schema.TABLE_CONSTRAINTS
             WHERE CONSTRAINT_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_NAME = ? AND CONSTRAINT_TYPE = ?',
            [$database, $table, $foreignKey, 'FOREIGN KEY']
        );

        return (int) ($result->count ?? 0) > 0;
    }
};
