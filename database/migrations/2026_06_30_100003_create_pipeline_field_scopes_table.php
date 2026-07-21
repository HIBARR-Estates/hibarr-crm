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

        // See 2026_06_30_100002_create_custom_field_category_scopes_table for why a
        // previous partial run may need to be recreated cleanly here.
        if (
            $isMysql
            && Schema::hasTable('pipeline_field_scopes')
            && !Schema::hasColumn('pipeline_field_scopes', 'pipeline_stage_id_norm')
        ) {
            Schema::dropIfExists('pipeline_field_scopes');
        }

        if (!Schema::hasTable('pipeline_field_scopes')) {
            Schema::create('pipeline_field_scopes', function (Blueprint $table) use ($isMysql) {
                $table->id();
                $table->unsignedInteger('company_id')->nullable();
                $table->string('scopeable_type', 50);
                $table->string('scopeable_key', 191);
                $table->string('model', 191);
                $table->unsignedBigInteger('pipeline_id');
                $table->unsignedInteger('pipeline_stage_id')->nullable();
                $table->timestamps();

                if ($isMysql) {
                    // See 2026_06_30_100002_create_custom_field_category_scopes_table for
                    // why a stored generated column is used instead of a functional index,
                    // and why it must be defined here (inside CREATE TABLE) rather than via
                    // a later ALTER TABLE.
                    $table->unsignedInteger('pipeline_stage_id_norm')
                        ->storedAs('COALESCE(pipeline_stage_id, 0)');
                }

                $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade')->onUpdate('cascade');
                $table->foreign('pipeline_id')->references('id')->on('lead_pipelines')->onDelete('cascade')->onUpdate('cascade');
                $table->foreign('pipeline_stage_id')->references('id')->on('pipeline_stages')->onDelete('cascade')->onUpdate('cascade');
            });
        }

        if ($isMysql) {
            if (!$this->indexExists('pipeline_field_scopes', 'pipeline_field_scope_unique')) {
                DB::statement(
                    'CREATE UNIQUE INDEX pipeline_field_scope_unique ON pipeline_field_scopes '
                    . '(scopeable_type, scopeable_key, model, pipeline_id, pipeline_stage_id_norm)'
                );
            }
        } elseif (!$this->indexExists('pipeline_field_scopes', 'pipeline_field_scope_unique')) {
            Schema::table('pipeline_field_scopes', function (Blueprint $table) {
                $table->unique(
                    ['scopeable_type', 'scopeable_key', 'model', 'pipeline_id', 'pipeline_stage_id'],
                    'pipeline_field_scope_unique'
                );
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('pipeline_field_scopes');
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
