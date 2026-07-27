<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Repair custom_field_category_scopes on environments where 100002 recorded
     * as Ran but never attached the pipeline_stage_id FK (MySQL #1215: CASCADE
     * is forbidden on the base column of a STORED generated column).
     *
     * MySQL cannot MODIFY STORED -> VIRTUAL (error 3106), so the norm column is
     * dropped and re-added as VIRTUAL when needed. A dedicated category_id index
     * is added first so dropping cfc_scope_unique does not break the category FK
     * (error 1553). Row data is untouched (norm is derived). Then adds the stage
     * FK with CASCADE. No-op when already correct.
     */
    public function up(): void
    {
        if (!Schema::hasTable('custom_field_category_scopes')) {
            return;
        }

        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'mysql') {
            $this->ensureMysqlNormIsVirtual();
        }

        if ($this->foreignKeyExists(
            'custom_field_category_scopes',
            'custom_field_category_scopes_pipeline_stage_id_foreign'
        )) {
            return;
        }

        Schema::table('custom_field_category_scopes', function (Blueprint $table) {
            $table->foreign('pipeline_stage_id')
                ->references('id')
                ->on('pipeline_stages')
                ->onDelete('cascade')
                ->onUpdate('cascade');
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('custom_field_category_scopes')) {
            return;
        }

        if (!$this->foreignKeyExists(
            'custom_field_category_scopes',
            'custom_field_category_scopes_pipeline_stage_id_foreign'
        )) {
            return;
        }

        Schema::table('custom_field_category_scopes', function (Blueprint $table) {
            $table->dropForeign(['pipeline_stage_id']);
        });
    }

    private function ensureMysqlNormIsVirtual(): void
    {
        if (!Schema::hasColumn('custom_field_category_scopes', 'pipeline_stage_id_norm')) {
            return;
        }

        $extra = DB::selectOne(
            'SELECT EXTRA AS extra FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = ?
               AND COLUMN_NAME = ?',
            ['custom_field_category_scopes', 'pipeline_stage_id_norm']
        )?->extra ?? '';

        if (!str_contains(strtoupper((string) $extra), 'STORED')) {
            return;
        }

        // MySQL forbids changing STORED <-> VIRTUAL via MODIFY (HY000/3106).
        // Drop + re-add keeps base row data; the column is derived from pipeline_stage_id.
        //
        // cfc_scope_unique starts with category_id, so InnoDB may be using it as the
        // supporting index for the category_id FK (error 1553 if dropped directly).
        // Ensure a dedicated category_id index exists first.
        if (!$this->indexExists('custom_field_category_scopes', 'cfc_scopes_category_id_idx')) {
            DB::statement(
                'CREATE INDEX `cfc_scopes_category_id_idx`
                 ON `custom_field_category_scopes` (`category_id`)'
            );
        }

        if ($this->indexExists('custom_field_category_scopes', 'cfc_scope_unique')) {
            DB::statement('ALTER TABLE `custom_field_category_scopes` DROP INDEX `cfc_scope_unique`');
        }

        DB::statement('ALTER TABLE `custom_field_category_scopes` DROP COLUMN `pipeline_stage_id_norm`');

        DB::statement(
            'ALTER TABLE `custom_field_category_scopes`
             ADD `pipeline_stage_id_norm` INT UNSIGNED
             GENERATED ALWAYS AS (COALESCE(`pipeline_stage_id`, 0)) VIRTUAL'
        );

        DB::statement(
            'CREATE UNIQUE INDEX `cfc_scope_unique` ON `custom_field_category_scopes`
             (`category_id`, `pipeline_id`, `pipeline_stage_id_norm`)'
        );
    }

    private function indexExists(string $table, string $indexName): bool
    {
        return count(DB::select("SHOW INDEX FROM `{$table}` WHERE Key_name = ?", [$indexName])) > 0;
    }

    private function foreignKeyExists(string $table, string $constraintName): bool
    {
        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'mysql') {
            return count(DB::select(
                'SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
                 WHERE CONSTRAINT_SCHEMA = DATABASE()
                   AND TABLE_NAME = ?
                   AND CONSTRAINT_NAME = ?
                   AND CONSTRAINT_TYPE = ?',
                [$table, $constraintName, 'FOREIGN KEY']
            )) > 0;
        }

        if ($driver === 'pgsql') {
            return count(DB::select(
                'SELECT 1 FROM information_schema.table_constraints
                 WHERE constraint_schema = current_schema()
                   AND table_name = ?
                   AND constraint_name = ?
                   AND constraint_type = ?',
                [$table, $constraintName, 'FOREIGN KEY']
            )) > 0;
        }

        if ($driver === 'sqlite') {
            return collect(DB::select("PRAGMA foreign_key_list(\"{$table}\")"))
                ->contains(fn ($fk) => $fk->table === 'pipeline_stages' && $fk->from === 'pipeline_stage_id');
        }

        return true;
    }
};
