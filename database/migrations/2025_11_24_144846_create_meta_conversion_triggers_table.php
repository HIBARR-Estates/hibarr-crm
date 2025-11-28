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
        Schema::create('meta_conversion_triggers', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('lead_pipeline_id');
            $table->unsignedInteger('lead_pipeline_stage_id');
            $table->string('event_name');
            $table->boolean('active')->default(true);
            $table->integer('company_id')->unsigned()->nullable();
            $table->timestamps();

            // Foreign keys
            $table->foreign('lead_pipeline_id')
                ->references('id')
                ->on('lead_pipelines')
                ->onUpdate('CASCADE')
                ->onDelete('CASCADE');

            $table->foreign('lead_pipeline_stage_id')
                ->references('id')
                ->on('pipeline_stages')
                ->onUpdate('CASCADE')
                ->onDelete('CASCADE');

            $table->foreign('company_id')
                ->references('id')
                ->on('companies')
                ->onDelete('cascade')
                ->onUpdate('cascade');

            // Unique constraint to prevent duplicate triggers for same pipeline + stage
            $table->unique(['lead_pipeline_id', 'lead_pipeline_stage_id'], 'unique_pipeline_stage_trigger');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('meta_conversion_triggers');
    }
};
