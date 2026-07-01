<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('package_pipeline', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedBigInteger('package_id');
            $table->unsignedBigInteger('pipeline_id');
            $table->unsignedInteger('default_stage_id')->nullable();
            $table->timestamps();

            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade')->onUpdate('cascade');
            $table->foreign('package_id')->references('id')->on('packages')->onDelete('cascade')->onUpdate('cascade');
            $table->foreign('pipeline_id')->references('id')->on('lead_pipelines')->onDelete('cascade')->onUpdate('cascade');
            $table->foreign('default_stage_id')->references('id')->on('pipeline_stages')->onDelete('set null')->onUpdate('cascade');

            $table->unique('package_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('package_pipeline');
    }
};
