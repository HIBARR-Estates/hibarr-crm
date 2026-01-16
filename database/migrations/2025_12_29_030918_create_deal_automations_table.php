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
        Schema::create('deal_automations', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->unsignedBigInteger('pipeline_id')->nullable();
            $table->string('trigger')->nullable();
            $table->boolean('active')->default(true);
            $table->integer('priority')->default(0);
            $table->timestamps();

            $table->foreign('pipeline_id')->references('id')->on('lead_pipelines')->onDelete('cascade');
            $table->index(['pipeline_id', 'active', 'priority']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('deal_automations');
    }
};
