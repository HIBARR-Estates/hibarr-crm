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
        Schema::create('deal_automation_actions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('deal_automation_id');
            $table->unsignedInteger('target_stage_id');
            $table->unsignedBigInteger('target_pipeline_id')->nullable();
            $table->boolean('forward_only')->default(true);
            $table->timestamps();

            $table->foreign('deal_automation_id')->references('id')->on('deal_automations')->onDelete('cascade');
            $table->foreign('target_stage_id')->references('id')->on('pipeline_stages')->onDelete('cascade');
            $table->foreign('target_pipeline_id')->references('id')->on('lead_pipelines')->onDelete('cascade');
            $table->index(['deal_automation_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('deal_automation_actions');
    }
};
