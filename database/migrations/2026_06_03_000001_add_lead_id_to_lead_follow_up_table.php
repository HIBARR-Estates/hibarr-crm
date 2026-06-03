<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('lead_follow_up')) {
            return;
        }

        if (!Schema::hasColumn('lead_follow_up', 'lead_id')) {
            Schema::table('lead_follow_up', function (Blueprint $table) {
                $table->unsignedInteger('lead_id')->nullable()->after('id');
                $table->index('lead_id', 'lead_follow_up_lead_id_index');
            });
        }

        if (Schema::hasColumn('lead_follow_up', 'lead_id') && Schema::hasColumn('lead_follow_up', 'deal_id')) {
            DB::statement('
                UPDATE lead_follow_up f
                INNER JOIN deals d ON f.deal_id = d.id
                SET f.lead_id = d.lead_id
                WHERE f.lead_id IS NULL AND d.lead_id IS NOT NULL
            ');
        }

        if (Schema::hasColumn('lead_follow_up', 'lead_id') && !$this->foreignKeyExists('lead_follow_up', 'lead_follow_up_lead_id_foreign')) {
            Schema::table('lead_follow_up', function (Blueprint $table) {
                $table->foreign('lead_id', 'lead_follow_up_lead_id_foreign')
                    ->references('id')
                    ->on('leads')
                    ->onUpdate('cascade')
                    ->onDelete('cascade');
            });
        }
    }

    public function down(): void
    {
        if (!Schema::hasTable('lead_follow_up') || !Schema::hasColumn('lead_follow_up', 'lead_id')) {
            return;
        }

        if ($this->foreignKeyExists('lead_follow_up', 'lead_follow_up_lead_id_foreign')) {
            Schema::table('lead_follow_up', function (Blueprint $table) {
                $table->dropForeign('lead_follow_up_lead_id_foreign');
            });
        }

        Schema::table('lead_follow_up', function (Blueprint $table) {
            $table->dropIndex('lead_follow_up_lead_id_index');
            $table->dropColumn('lead_id');
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
