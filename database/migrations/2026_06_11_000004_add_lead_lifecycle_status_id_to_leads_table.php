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

        if (!Schema::hasColumn('leads', 'lead_lifecycle_status_id')) {
            Schema::table('leads', function (Blueprint $table) {
                $table->unsignedBigInteger('lead_lifecycle_status_id')->nullable()->after('status_id');
                $table->index('lead_lifecycle_status_id', 'leads_lead_lifecycle_status_id_index');
            });
        }

        if (
            Schema::hasColumn('leads', 'lead_lifecycle_status_id')
            && !$this->foreignKeyExists('leads', 'leads_lead_lifecycle_status_id_foreign')
        ) {
            Schema::table('leads', function (Blueprint $table) {
                $table->foreign('lead_lifecycle_status_id', 'leads_lead_lifecycle_status_id_foreign')
                    ->references('id')
                    ->on('lead_lifecycle_statuses')
                    ->onUpdate('cascade')
                    ->onDelete('set null');
            });
        }
    }

    public function down(): void
    {
        if (!Schema::hasTable('leads') || !Schema::hasColumn('leads', 'lead_lifecycle_status_id')) {
            return;
        }

        if ($this->foreignKeyExists('leads', 'leads_lead_lifecycle_status_id_foreign')) {
            Schema::table('leads', function (Blueprint $table) {
                $table->dropForeign('leads_lead_lifecycle_status_id_foreign');
            });
        }

        Schema::table('leads', function (Blueprint $table) {
            $table->dropIndex('leads_lead_lifecycle_status_id_index');
            $table->dropColumn('lead_lifecycle_status_id');
        });
    }

    private function foreignKeyExists(string $table, string $foreignKey): bool
    {
        $connection = Schema::getConnection();
        $database = $connection->getDatabaseName();

        $result = $connection->selectOne(
            'SELECT COUNT(*) AS count FROM information_schema.TABLE_CONSTRAINTS
             WHERE CONSTRAINT_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_NAME = ? AND CONSTRAINT_TYPE = ?',
            [$database, $table, $foreignKey, 'FOREIGN KEY']
        );

        return (int) ($result->count ?? 0) > 0;
    }
};
