<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('deal_automation_actions', function (Blueprint $table) {
            // Drop the existing foreign key before altering the column
            $table->dropForeign(['target_stage_id']);

            // Make target_stage_id nullable so non-stage-transition actions can be saved
            $table->unsignedInteger('target_stage_id')->nullable()->change();

            // Re-add foreign key with SET NULL on delete (nullable column)
            $table->foreign('target_stage_id')
                ->references('id')
                ->on('pipeline_stages')
                ->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('deal_automation_actions', function (Blueprint $table) {
            $table->dropForeign(['target_stage_id']);

            $table->unsignedInteger('target_stage_id')->nullable(false)->change();

            $table->foreign('target_stage_id')
                ->references('id')
                ->on('pipeline_stages')
                ->onDelete('cascade');
        });
    }
};
