<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('email_send_attempts')) {
            return;
        }

        Schema::create('email_send_attempts', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->unsignedInteger('company_id');
            $table->unsignedBigInteger('connection_id');
            $table->unsignedInteger('created_by')->nullable();
            // The exact draft as composed, kept so a failed send can be retried or edited.
            $table->longText('draft_payload');
            // Assigned by the CRM before the first submission; a retry resubmits the same id.
            $table->string('rfc_message_id', 998)->nullable();
            // sending | sent | failed | checking | waiting_quota — there is no "delivered".
            $table->string('status', 32)->default('sending');
            $table->string('provider_submission_id', 191)->nullable();
            $table->string('error_code', 64)->nullable();
            $table->unsignedInteger('attempt_count')->default(0);
            $table->timestamp('last_attempted_at')->nullable();
            $table->timestamp('next_attempt_at')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamps();

            $table->index(['company_id', 'status'], 'email_send_attempts_company_status_index');
            $table->index(['connection_id', 'status'], 'email_send_attempts_connection_status_index');

            $table->foreign('company_id')
                ->references('id')
                ->on('companies')
                ->onDelete('cascade')
                ->onUpdate('cascade');
            $table->foreign('connection_id')
                ->references('id')
                ->on('email_connections')
                ->onDelete('cascade')
                ->onUpdate('cascade');
            $table->foreign('created_by')
                ->references('id')
                ->on('users')
                ->onDelete('set null')
                ->onUpdate('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('email_send_attempts');
    }
};
