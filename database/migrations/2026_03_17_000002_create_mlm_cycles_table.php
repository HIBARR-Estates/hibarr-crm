<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('mlm_cycles', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id');
            $table->unsignedBigInteger('cycle_config_id');
            $table->unsignedInteger('cycle_number');
            $table->date('start_date');
            $table->date('end_date');
            $table->string('status', 20)->default('upcoming'); // upcoming, active, completed
            $table->timestamps();

            $table->unique(['company_id', 'cycle_number']);
            $table->index(['company_id', 'status']);
            $table->foreign('company_id')->references('id')->on('companies')->cascadeOnDelete();
            $table->foreign('cycle_config_id')->references('id')->on('mlm_cycle_configs')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mlm_cycles');
    }
};
