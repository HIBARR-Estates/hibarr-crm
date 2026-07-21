<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $isMysql = Schema::getConnection()->getDriverName() === 'mysql';

        // A previous partial run of this migration may have created the table
        // and then failed before adding the generated column/unique index
        // (MySQL #1215 when that's done via a later ALTER TABLE). Recreate
        // cleanly in that case rather than failing on "table already exists".
        if (
            $isMysql
            && Schema::hasTable('custom_field_category_scopes')
            && !Schema::hasColumn('custom_field_category_scopes', 'pipeline_stage_id_norm')
        ) {
            Schema::dropIfExists('custom_field_category_scopes');
        }

        if (!Schema::hasTable('custom_field_category_scopes')) {
            Schema::create('custom_field_category_scopes', function (Blueprint $table) use ($isMysql) {
                $table->id();
                $table->unsignedInteger('company_id')->nullable();
                $table->unsignedBigInteger('category_id');
                $table->unsignedBigInteger('pipeline_id');
                $table->unsignedInteger('pipeline_stage_id')->nullable();
                $table->timestamps();

                if ($isMysql) {
                    // A stored generated column normalizes NULL -> 0 so a plain unique
                    // index can enforce "one row per (category, pipeline, stage-or-
                    // pipeline-wide)". Generated columns are supported identically by
                    // MySQL 5.7+ and MariaDB, unlike functional indexes directly on an
                    // expression, which MariaDB does not support at all. Defined here
                    // (inside CREATE TABLE) rather than via a later ALTER TABLE, because
                    // MySQL rebuilds the table to add a stored generated column and that
                    // rebuild fails (#1215 Cannot add foreign key constraint) once the
                    // table's foreign keys already exist.
                    $table->unsignedInteger('pipeline_stage_id_norm')
                        ->storedAs('COALESCE(pipeline_stage_id, 0)');
                }

                $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade')->onUpdate('cascade');
                $table->foreign('category_id')->references('id')->on('custom_field_categories')->onDelete('cascade')->onUpdate('cascade');
                $table->foreign('pipeline_id')->references('id')->on('lead_pipelines')->onDelete('cascade')->onUpdate('cascade');
                $table->foreign('pipeline_stage_id')->references('id')->on('pipeline_stages')->onDelete('cascade')->onUpdate('cascade');
            });
        }

        if ($isMysql) {
            if (!$this->indexExists('custom_field_category_scopes', 'cfc_scope_unique')) {
                DB::statement(
                    'CREATE UNIQUE INDEX cfc_scope_unique ON custom_field_category_scopes '
                    . '(category_id, pipeline_id, pipeline_stage_id_norm)'
                );
            }
        } elseif (!$this->indexExists('custom_field_category_scopes', 'cfc_scope_unique')) {
            Schema::table('custom_field_category_scopes', function (Blueprint $table) {
                $table->unique(['category_id', 'pipeline_id', 'pipeline_stage_id'], 'cfc_scope_unique');
            });
        }

        if (Schema::hasTable('custom_field_category_pipeline')) {
            DB::transaction(function () {
                $rows = DB::table('custom_field_category_pipeline as cfcp')
                    ->join('lead_pipelines as lp', 'lp.id', '=', 'cfcp.pipeline_id')
                    ->select('cfcp.category_id', 'cfcp.pipeline_id', 'lp.company_id')
                    ->distinct()
                    ->get();

                if ($rows->isEmpty()) {
                    return;
                }

                $now = now();
                $insertRows = $rows->map(fn ($row) => [
                    'company_id' => $row->company_id,
                    'category_id' => $row->category_id,
                    'pipeline_id' => $row->pipeline_id,
                    'pipeline_stage_id' => null,
                    'created_at' => $now,
                    'updated_at' => $now,
                ])->all();

                foreach (array_chunk($insertRows, 500) as $chunk) {
                    // insertOrIgnore: a duplicate row in the legacy pivot must not
                    // abort the whole backfill now that it collides with the unique index.
                    DB::table('custom_field_category_scopes')->insertOrIgnore($chunk);
                }
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('custom_field_category_scopes');
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

        return false;
    }
};
