<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('agent_level_history', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedBigInteger('agent_id');
            $table->unsignedBigInteger('level_id');
            $table->timestamp('assigned_at')->useCurrent();
            $table->unsignedInteger('assigned_by')->nullable(); // admin user who manually assigned
            $table->boolean('system_assigned')->default(false);
            $table->unsignedBigInteger('trigger_deal_id')->nullable(); // deal that caused level-up
            $table->timestamps();

            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->foreign('agent_id')->references('id')->on('lead_agents')->onDelete('cascade');
            $table->foreign('level_id')->references('id')->on('mlm_levels')->onDelete('cascade');
            $table->foreign('assigned_by')->references('id')->on('users')->onDelete('set null');
            $table->foreign('trigger_deal_id')->references('id')->on('deals')->onDelete('set null');

            $table->index(['agent_id', 'assigned_at']);
            $table->index('company_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('agent_level_history');
    }
};
