<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('mlm_commissions', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedBigInteger('deal_id');
            $table->unsignedBigInteger('agent_id');          // who receives the commission
            $table->unsignedBigInteger('source_agent_id');    // who closed the deal
            $table->unsignedBigInteger('level_id')->nullable(); // null for system-type entries
            $table->unsignedDecimal('percentage', 5, 2);
            $table->unsignedDecimal('amount', 15, 2);
            $table->string('type', 20);    // agent, upline, system
            $table->string('status', 20)->default('pending'); // pending, paid, reverted
            $table->timestamp('paid_at')->nullable();
            $table->timestamp('reverted_at')->nullable();
            $table->text('reverted_reason')->nullable();
            $table->timestamps();

            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->foreign('deal_id')->references('id')->on('deals')->onDelete('cascade');
            $table->foreign('agent_id')->references('id')->on('lead_agents')->onDelete('cascade');
            $table->foreign('source_agent_id')->references('id')->on('lead_agents')->onDelete('cascade');
            $table->foreign('level_id')->references('id')->on('mlm_levels')->onDelete('set null');

            $table->index(['deal_id', 'type']);
            $table->index(['agent_id', 'status']);
            $table->index('company_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mlm_commissions');
    }
};
