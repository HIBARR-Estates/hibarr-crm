<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('email_handoffs')) {
            return;
        }

        Schema::create('email_handoffs', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->unsignedInteger('company_id');
            $table->unsignedBigInteger('mailbox_copy_id');
            $table->unsignedBigInteger('conversation_id')->nullable();
            $table->unsignedInteger('from_user_id');
            $table->unsignedInteger('to_user_id');
            // handoff | escalate
            $table->string('type', 16);
            // pending | accepted | rejected
            $table->string('status', 16)->default('pending');
            $table->string('note', 500)->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->unsignedInteger('resolved_by')->nullable();
            $table->timestamps();

            $table->index(['company_id', 'to_user_id', 'status'], 'email_handoffs_to_status_index');
            $table->index(['company_id', 'from_user_id', 'status'], 'email_handoffs_from_status_index');
            $table->index(['mailbox_copy_id', 'status'], 'email_handoffs_copy_status_index');

            $table->foreign('company_id')
                ->references('id')
                ->on('companies')
                ->onDelete('cascade')
                ->onUpdate('cascade');
            $table->foreign('mailbox_copy_id')
                ->references('id')
                ->on('email_mailbox_copies')
                ->onDelete('cascade')
                ->onUpdate('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('email_handoffs');
    }
};
