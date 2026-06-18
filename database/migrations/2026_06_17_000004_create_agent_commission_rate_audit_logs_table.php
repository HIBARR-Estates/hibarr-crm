<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('agent_commission_rate_audit_logs', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id');
            $table->unsignedBigInteger('agent_id');
            $table->unsignedInteger('changed_by_user_id')->nullable();
            $table->decimal('previous_direct_rate', 5, 2)->nullable();
            $table->decimal('new_direct_rate', 5, 2)->nullable();
            $table->decimal('previous_override_rate', 5, 2)->nullable();
            $table->decimal('new_override_rate', 5, 2)->nullable();
            $table->timestamp('changed_at');
            $table->text('reason')->nullable();
            $table->timestamps();

            $table->foreign('company_id')->references('id')->on('companies')->cascadeOnDelete();
            $table->foreign('agent_id')->references('id')->on('lead_agents')->cascadeOnDelete();
            $table->foreign('changed_by_user_id')->references('id')->on('users')->nullOnDelete();

            $table->index(['agent_id', 'changed_at']);
            $table->index('company_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('agent_commission_rate_audit_logs');
    }
};
