<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Pivot table: many-to-many between pipelines and custom field categories.
     *
     * @return void
     */
    public function up(): void
    {
        Schema::create('custom_field_category_pipeline', function (Blueprint $table) {
            $table->unsignedBigInteger('category_id');
            $table->unsignedBigInteger('pipeline_id');

            $table->primary(['category_id', 'pipeline_id']);

            $table->foreign('category_id')
                ->references('id')
                ->on('custom_field_categories')
                ->onDelete('cascade')
                ->onUpdate('cascade');

            $table->foreign('pipeline_id')
                ->references('id')
                ->on('lead_pipelines')
                ->onDelete('cascade')
                ->onUpdate('cascade');
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down(): void
    {
        Schema::dropIfExists('custom_field_category_pipeline');
    }
};
