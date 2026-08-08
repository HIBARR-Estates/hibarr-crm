<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pipeline_analysis_scripts', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('pipeline_id');
            $table->unsignedInteger('company_id');
            $table->timestamps();

            $table->foreign('pipeline_id')->references('id')->on('lead_pipelines')->cascadeOnDelete();
            $table->unique('pipeline_id');
        });

        Schema::create('pipeline_analysis_script_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('analysis_script_id')->constrained('pipeline_analysis_scripts')->cascadeOnDelete();
            $table->enum('type', ['custom_field_category', 'native_field', 'hibarr_field', 'lead_field']);
            $table->string('item_key');
            $table->string('label_override')->nullable();
            $table->text('guide_text')->nullable();
            $table->smallInteger('position')->unsigned()->default(0);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pipeline_analysis_script_items');
        Schema::dropIfExists('pipeline_analysis_scripts');
    }
};
