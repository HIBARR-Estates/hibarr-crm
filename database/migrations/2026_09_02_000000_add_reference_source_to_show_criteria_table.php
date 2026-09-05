<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('show_criteria', function (Blueprint $table) {
            if (! Schema::hasColumn('show_criteria', 'reference_source')) {
                $table->enum('reference_source', ['custom_field', 'pipeline', 'pipeline_stage', 'deal_package'])
                    ->default('custom_field')
                    ->after('group_id');
            }
        });

        Schema::table('show_criteria', function (Blueprint $table) {
            // Existing rows are all 'custom_field' (the column default), so no
            // backfill is needed before relaxing this constraint.
            $table->dropForeign(['reference_field_id']);
            $table->unsignedInteger('reference_field_id')->nullable()->change();
            $table->foreign('reference_field_id')->references('id')->on('custom_fields')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // A pipeline/pipeline_stage/deal_package/record criterion has no
        // reference_field_id (it's null by design — see up()'s comment).
        // Restoring the NOT NULL constraint without first clearing those
        // rows would fail the ALTER (or, depending on SQL mode, silently
        // corrupt them) the moment any such criterion exists.
        if (Schema::hasColumn('show_criteria', 'reference_source')) {
            DB::table('show_criteria')->where('reference_source', '!=', 'custom_field')->delete();
        }

        Schema::table('show_criteria', function (Blueprint $table) {
            $table->dropForeign(['reference_field_id']);
            $table->unsignedInteger('reference_field_id')->nullable(false)->change();
            $table->foreign('reference_field_id')->references('id')->on('custom_fields')->onDelete('cascade');
        });

        Schema::table('show_criteria', function (Blueprint $table) {
            if (Schema::hasColumn('show_criteria', 'reference_source')) {
                $table->dropColumn('reference_source');
            }
        });
    }
};
