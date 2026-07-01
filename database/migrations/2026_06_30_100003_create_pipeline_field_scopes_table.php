<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pipeline_field_scopes', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id')->nullable();
            $table->string('scopeable_type', 50);
            $table->string('scopeable_key', 191);
            $table->string('model', 191);
            $table->unsignedBigInteger('pipeline_id');
            $table->unsignedInteger('pipeline_stage_id')->nullable();
            $table->timestamps();

            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade')->onUpdate('cascade');
            $table->foreign('pipeline_id')->references('id')->on('lead_pipelines')->onDelete('cascade')->onUpdate('cascade');
            $table->foreign('pipeline_stage_id')->references('id')->on('pipeline_stages')->onDelete('cascade')->onUpdate('cascade');

            $table->unique(
                ['scopeable_type', 'scopeable_key', 'model', 'pipeline_id', 'pipeline_stage_id'],
                'pipeline_field_scope_unique'
            );
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pipeline_field_scopes');
    }
};
