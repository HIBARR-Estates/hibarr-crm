<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('agent_cycle_enrollments', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id');
            $table->unsignedBigInteger('agent_id');
            $table->unsignedBigInteger('cycle_id');
            $table->date('effective_start_date');
            $table->date('effective_end_date')->nullable();
            $table->string('status', 20)->default('active'); // active, extended, completed, force_completed
            $table->timestamp('criteria_met_at')->nullable();
            $table->date('overflow_start_date')->nullable();
            $table->date('max_overflow_date')->nullable();
            $table->unsignedBigInteger('level_achieved_id')->nullable();
            $table->timestamps();

            $table->unique(['agent_id', 'cycle_id']);
            $table->index(['agent_id', 'status']);
            $table->index(['company_id', 'status']);

            $table->foreign('company_id')->references('id')->on('companies')->cascadeOnDelete();
            $table->foreign('agent_id')->references('id')->on('lead_agents')->cascadeOnDelete();
            $table->foreign('cycle_id')->references('id')->on('mlm_cycles')->cascadeOnDelete();
            $table->foreign('level_achieved_id')->references('id')->on('mlm_levels')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('agent_cycle_enrollments');
    }
};
