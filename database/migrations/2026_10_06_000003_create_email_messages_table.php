<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('email_messages')) {
            return;
        }

        Schema::create('email_messages', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->unsignedInteger('company_id');
            // RFC Message-IDs can be up to 998 characters — too long to index
            // directly, so uniqueness runs on a hash of the normalized id.
            $table->string('rfc_message_id', 998)->nullable();
            $table->char('rfc_message_id_hash', 64)->nullable();
            $table->string('in_reply_to', 998)->nullable();
            $table->json('reference_ids')->nullable();
            $table->json('thread_keys')->nullable();
            $table->string('from_email')->nullable();
            $table->string('from_name')->nullable();
            $table->json('to_recipients')->nullable();
            $table->json('cc_recipients')->nullable();
            $table->json('reply_to_recipients')->nullable();
            $table->string('subject', 998)->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->longText('text_body')->nullable();
            $table->longText('html_raw')->nullable();
            $table->longText('html_safe')->nullable();
            $table->boolean('has_attachments')->default(false);
            $table->boolean('is_partial')->default(false);
            $table->timestamps();

            // One canonical message per company and Message-ID. Rows without
            // a Message-ID have a null hash and are never deduplicated.
            $table->unique(['company_id', 'rfc_message_id_hash'], 'email_messages_company_rfc_hash_unique');
            $table->index(['company_id', 'sent_at'], 'email_messages_company_sent_at_index');
            $table->index(['company_id', 'from_email'], 'email_messages_company_from_index');

            $table->foreign('company_id')
                ->references('id')
                ->on('companies')
                ->onDelete('cascade')
                ->onUpdate('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('email_messages');
    }
};
