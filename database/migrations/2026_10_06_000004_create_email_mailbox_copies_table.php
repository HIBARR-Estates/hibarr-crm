<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('email_mailbox_copies')) {
            return;
        }

        Schema::create('email_mailbox_copies', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->unsignedInteger('company_id');
            $table->unsignedBigInteger('connection_id');
            $table->unsignedBigInteger('message_id');
            $table->string('provider_message_id', 191);
            $table->string('folder', 191)->nullable();
            $table->string('direction', 16);
            $table->string('review_status', 32)->default('none');
            // Known only to the mailbox that sent the message, so it lives on
            // that mailbox's copy and never on the shared canonical message.
            $table->json('bcc_recipients')->nullable();
            // Attachment metadata as this provider lists it (part ids are provider-specific).
            $table->json('provider_attachments')->nullable();
            $table->timestamps();

            $table->unique(['connection_id', 'provider_message_id'], 'email_mailbox_copies_connection_provider_unique');
            $table->index('message_id', 'email_mailbox_copies_message_index');
            $table->index(['company_id', 'review_status'], 'email_mailbox_copies_company_review_index');

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
            $table->foreign('message_id')
                ->references('id')
                ->on('email_messages')
                ->onDelete('cascade')
                ->onUpdate('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('email_mailbox_copies');
    }
};
