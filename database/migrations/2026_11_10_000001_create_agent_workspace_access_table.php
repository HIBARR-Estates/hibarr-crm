<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Per-user overrides for the agent workspace at /agent.
 *
 * Every enabled, non-partner lead agent gets the workspace by default (see
 * AgentWorkspaceAccess). A row here overrides that default for one person:
 * "allow" lets in someone who is not a lead agent, "block" keeps a lead agent
 * out. The crm.agent-workspace flag stays the master switch above both.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('agent_workspace_access')) {
            return;
        }

        Schema::create('agent_workspace_access', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id');
            $table->unsignedInteger('user_id');
            // "allow" or "block".
            $table->string('access', 10);
            // Who last set this override.
            $table->unsignedInteger('added_by')->nullable();
            $table->timestamps();

            $table->unique(['company_id', 'user_id'], 'agent_workspace_access_company_user_unique');

            $table->foreign('company_id')->references('id')->on('companies')->cascadeOnDelete();
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('added_by')->references('id')->on('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('agent_workspace_access');
    }
};
