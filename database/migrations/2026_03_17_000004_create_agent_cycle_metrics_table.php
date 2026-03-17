<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('agent_cycle_metrics', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id');
            $table->unsignedBigInteger('enrollment_id');
            $table->unsignedBigInteger('agent_id'); // denormalized for fast NSD lookup
            $table->unsignedInteger('nsa')->default(0);
            $table->unsignedInteger('nsd')->default(0);
            $table->decimal('vsa', 15, 2)->default(0);
            $table->decimal('vsd', 15, 2)->default(0);
            $table->timestamps();

            $table->unique('enrollment_id');
            $table->index(['agent_id', 'enrollment_id']);

            $table->foreign('company_id')->references('id')->on('companies')->cascadeOnDelete();
            $table->foreign('enrollment_id')->references('id')->on('agent_cycle_enrollments')->cascadeOnDelete();
            $table->foreign('agent_id')->references('id')->on('lead_agents')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('agent_cycle_metrics');
    }
};
