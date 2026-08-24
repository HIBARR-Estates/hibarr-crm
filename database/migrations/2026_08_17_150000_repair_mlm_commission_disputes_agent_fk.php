<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('mlm_commission_disputes')) {
            return;
        }

        $agentColumn = collect(DB::select("SHOW COLUMNS FROM mlm_commission_disputes WHERE Field = 'agent_id'"))->first();
        $needsWiden = $agentColumn !== null
            && str_contains(strtolower((string) $agentColumn->Type), 'int')
            && ! str_contains(strtolower((string) $agentColumn->Type), 'bigint');

        if ($needsWiden) {
            Schema::table('mlm_commission_disputes', function (Blueprint $table) {
                $table->unsignedBigInteger('agent_id')->change();
            });
        }

        if (! $this->foreignKeyExists('mlm_commission_disputes', 'mlm_commission_disputes_agent_id_foreign')) {
            Schema::table('mlm_commission_disputes', function (Blueprint $table) {
                $table->foreign('agent_id')->references('id')->on('lead_agents')->cascadeOnDelete();
            });
        }

        if (! $this->indexExists('mlm_commission_disputes', 'mlm_commission_disputes_agent_id_index')) {
            Schema::table('mlm_commission_disputes', function (Blueprint $table) {
                $table->index('agent_id', 'mlm_commission_disputes_agent_id_index');
            });
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('mlm_commission_disputes')) {
            return;
        }

        Schema::table('mlm_commission_disputes', function (Blueprint $table) {
            if ($this->foreignKeyExists('mlm_commission_disputes', 'mlm_commission_disputes_agent_id_foreign')) {
                $table->dropForeign(['agent_id']);
            }

            if ($this->indexExists('mlm_commission_disputes', 'mlm_commission_disputes_agent_id_index')) {
                $table->dropIndex('mlm_commission_disputes_agent_id_index');
            }
        });
    }

    private function foreignKeyExists(string $table, string $constraint): bool
    {
        $database = Schema::getConnection()->getDatabaseName();

        return DB::table('information_schema.TABLE_CONSTRAINTS')
            ->where('TABLE_SCHEMA', $database)
            ->where('TABLE_NAME', $table)
            ->where('CONSTRAINT_NAME', $constraint)
            ->where('CONSTRAINT_TYPE', 'FOREIGN KEY')
            ->exists();
    }

    private function indexExists(string $table, string $index): bool
    {
        $database = Schema::getConnection()->getDatabaseName();

        return DB::table('information_schema.STATISTICS')
            ->where('TABLE_SCHEMA', $database)
            ->where('TABLE_NAME', $table)
            ->where('INDEX_NAME', $index)
            ->exists();
    }
};
