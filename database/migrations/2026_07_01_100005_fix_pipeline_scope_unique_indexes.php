<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::getConnection()->getDriverName() !== 'mysql') {
            return;
        }

        if (Schema::hasTable('custom_field_category_scopes')) {
            Schema::table('custom_field_category_scopes', function (Blueprint $table) {
                $table->dropUnique('cfc_scope_unique');
            });

            DB::statement(
                'CREATE UNIQUE INDEX cfc_scope_unique ON custom_field_category_scopes '
                . '(category_id, pipeline_id, (COALESCE(pipeline_stage_id, 0)))'
            );
        }

        if (Schema::hasTable('pipeline_field_scopes')) {
            Schema::table('pipeline_field_scopes', function (Blueprint $table) {
                $table->dropUnique('pipeline_field_scope_unique');
            });

            DB::statement(
                'CREATE UNIQUE INDEX pipeline_field_scope_unique ON pipeline_field_scopes '
                . '(scopeable_type, scopeable_key, model, pipeline_id, (COALESCE(pipeline_stage_id, 0)))'
            );
        }
    }

    public function down(): void
    {
        if (Schema::getConnection()->getDriverName() !== 'mysql') {
            return;
        }

        if (Schema::hasTable('custom_field_category_scopes')) {
            Schema::table('custom_field_category_scopes', function (Blueprint $table) {
                $table->dropUnique('cfc_scope_unique');
            });

            Schema::table('custom_field_category_scopes', function (Blueprint $table) {
                $table->unique(['category_id', 'pipeline_id', 'pipeline_stage_id'], 'cfc_scope_unique');
            });
        }

        if (Schema::hasTable('pipeline_field_scopes')) {
            Schema::table('pipeline_field_scopes', function (Blueprint $table) {
                $table->dropUnique('pipeline_field_scope_unique');
            });

            Schema::table('pipeline_field_scopes', function (Blueprint $table) {
                $table->unique(
                    ['scopeable_type', 'scopeable_key', 'model', 'pipeline_id', 'pipeline_stage_id'],
                    'pipeline_field_scope_unique'
                );
            });
        }
    }
};
