<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $driver = Schema::getConnection()->getDriverName();
        $isMysql = $driver === 'mysql';
        $usesStageNorm = in_array($driver, ['mysql', 'sqlite', 'pgsql'], true);

        // See 2026_06_30_100002_create_custom_field_category_scopes_table for why a
        // previous partial run may need to be recreated cleanly here.
        // Also drop leftovers that have the generated column but never got the stage FK
        // (MySQL #1215 with STORED + CASCADE), so remigrate does not skip create.
        if (
            $isMysql
            && Schema::hasTable('pipeline_field_scopes')
            && (
                !Schema::hasColumn('pipeline_field_scopes', 'pipeline_stage_id_norm')
                || !$this->foreignKeyExists('pipeline_field_scopes', 'pipeline_field_scopes_pipeline_stage_id_foreign')
            )
        ) {
            Schema::dropIfExists('pipeline_field_scopes');
        }

        if (!Schema::hasTable('pipeline_field_scopes')) {
            Schema::create('pipeline_field_scopes', function (Blueprint $table) use ($isMysql, $usesStageNorm) {
                $table->id();
                $table->unsignedInteger('company_id')->nullable();
                $table->string('scopeable_type', 50);
                $table->string('scopeable_key', 191);
                $table->string('model', 191);
                $table->unsignedBigInteger('pipeline_id');
                $table->unsignedInteger('pipeline_stage_id')->nullable();
                $table->timestamps();

                if ($usesStageNorm) {
                    // MySQL: VIRTUAL so CASCADE FK on pipeline_stage_id is allowed.
                    // SQLite/pgsql: STORED (pgsql has no VIRTUAL generated columns).
                    $norm = $table->unsignedInteger('pipeline_stage_id_norm');
                    $isMysql
                        ? $norm->virtualAs('COALESCE(pipeline_stage_id, 0)')
                        : $norm->storedAs('COALESCE(pipeline_stage_id, 0)');
                }

                $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade')->onUpdate('cascade');
                $table->foreign('pipeline_id')->references('id')->on('lead_pipelines')->onDelete('cascade')->onUpdate('cascade');
                $table->foreign('pipeline_stage_id')->references('id')->on('pipeline_stages')->onDelete('cascade')->onUpdate('cascade');
            });
        } elseif ($usesStageNorm && !Schema::hasColumn('pipeline_field_scopes', 'pipeline_stage_id_norm')) {
            Schema::table('pipeline_field_scopes', function (Blueprint $table) use ($isMysql) {
                $norm = $table->unsignedInteger('pipeline_stage_id_norm');
                $isMysql
                    ? $norm->virtualAs('COALESCE(pipeline_stage_id, 0)')
                    : $norm->storedAs('COALESCE(pipeline_stage_id, 0)');
            });
        }

        if ($usesStageNorm) {
            if ($this->indexExists('pipeline_field_scopes', 'pipeline_field_scope_unique')) {
                $this->dropIndexIfExists('pipeline_field_scopes', 'pipeline_field_scope_unique');
            }

            if (!$this->indexExists('pipeline_field_scopes', 'pipeline_field_scope_unique')) {
                DB::statement(
                    'CREATE UNIQUE INDEX pipeline_field_scope_unique ON pipeline_field_scopes '
                    . '(scopeable_type, scopeable_key, model, pipeline_id, pipeline_stage_id_norm)'
                );
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('pipeline_field_scopes');
    }

    private function foreignKeyExists(string $table, string $constraintName): bool
    {
        if (Schema::getConnection()->getDriverName() !== 'mysql') {
            return true;
        }

        return count(DB::select(
            'SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
             WHERE CONSTRAINT_SCHEMA = DATABASE()
               AND TABLE_NAME = ?
               AND CONSTRAINT_NAME = ?
               AND CONSTRAINT_TYPE = ?',
            [$table, $constraintName, 'FOREIGN KEY']
        )) > 0;
    }

    private function indexExists(string $table, string $indexName): bool
    {
        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'mysql') {
            return count(DB::select("SHOW INDEX FROM `{$table}` WHERE Key_name = ?", [$indexName])) > 0;
        }

        if ($driver === 'sqlite') {
            return collect(DB::select("PRAGMA index_list(\"{$table}\")"))
                ->contains(fn ($index) => $index->name === $indexName);
        }

        if ($driver === 'pgsql') {
            return count(DB::select(
                'SELECT 1 FROM pg_indexes WHERE schemaname = current_schema() AND indexname = ?',
                [$indexName]
            )) > 0;
        }

        return false;
    }

    private function dropIndexIfExists(string $table, string $indexName): void
    {
        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'mysql') {
            DB::statement("ALTER TABLE `{$table}` DROP INDEX `{$indexName}`");
        } elseif ($driver === 'sqlite') {
            DB::statement("DROP INDEX IF EXISTS \"{$indexName}\"");
        } elseif ($driver === 'pgsql') {
            DB::statement("DROP INDEX IF EXISTS \"{$indexName}\"");
        }
    }
};
