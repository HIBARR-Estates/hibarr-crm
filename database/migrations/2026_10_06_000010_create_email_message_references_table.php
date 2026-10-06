<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('email_message_references')) {
            return;
        }

        // The reply graph, one row per Message-ID a message points at through
        // In-Reply-To / References. email_messages keeps the same ids as JSON,
        // which cannot be indexed; this is what thread joins look up.
        Schema::create('email_message_references', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id');
            $table->unsignedBigInteger('message_id');
            // Hash of the normalized id, as on email_messages.rfc_message_id_hash.
            $table->char('reference_hash', 64);

            $table->unique(['message_id', 'reference_hash'], 'email_message_references_message_hash_unique');
            $table->index(['company_id', 'reference_hash'], 'email_message_references_company_hash_index');

            $table->foreign('company_id')
                ->references('id')
                ->on('companies')
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
        Schema::dropIfExists('email_message_references');
    }
};
