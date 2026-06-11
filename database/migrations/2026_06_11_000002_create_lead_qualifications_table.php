<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('lead_qualifications')) {
            return;
        }

        Schema::create('lead_qualifications', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id');
            $table->unsignedInteger('lead_id');
            $table->string('template_id');
            $table->unsignedInteger('template_version');
            $table->unsignedInteger('agent_id');
            $table->enum('status', ['inProgress', 'completed', 'abandoned'])->default('inProgress');
            $table->json('selected_branch_keys')->nullable();
            $table->enum('outcome', ['bookMeeting', 'inviteWebinar', 'callback', 'noFit'])->nullable();
            $table->timestamp('outcome_triggered_at')->nullable();
            $table->string('agent_language', 10)->nullable();
            $table->string('current_segment_key')->nullable();
            $table->timestamp('started_at');
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->foreign('company_id', 'lead_qualifications_company_id_foreign')
                ->references('id')
                ->on('companies')
                ->onUpdate('cascade')
                ->onDelete('cascade');

            $table->foreign('lead_id', 'lead_qualifications_lead_id_foreign')
                ->references('id')
                ->on('leads')
                ->onUpdate('cascade')
                ->onDelete('cascade');

            $table->foreign('agent_id', 'lead_qualifications_agent_id_foreign')
                ->references('id')
                ->on('users')
                ->onUpdate('cascade')
                ->onDelete('cascade');

            $table->index('lead_id');
            $table->index('company_id');
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lead_qualifications');
    }
};
