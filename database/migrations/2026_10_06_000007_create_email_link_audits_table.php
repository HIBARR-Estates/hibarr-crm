<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('email_link_audits')) {
            return;
        }

        Schema::create('email_link_audits', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id');
            // link | unlink | dismiss | handoff | escalate | accept | reject
            $table->string('action', 32);
            // Plain ids, no foreign keys: an audit row must outlive what it describes.
            $table->unsignedBigInteger('conversation_id')->nullable();
            $table->unsignedBigInteger('mailbox_copy_id')->nullable();
            $table->string('linkable_type', 32)->nullable();
            $table->unsignedBigInteger('linkable_id')->nullable();
            $table->unsignedInteger('actor_id')->nullable();
            $table->json('meta')->nullable();
            $table->timestamp('created_at')->nullable();

            $table->index(['company_id', 'conversation_id'], 'email_link_audits_company_conversation_index');
            $table->index(['company_id', 'linkable_type', 'linkable_id'], 'email_link_audits_company_record_index');

            $table->foreign('company_id')
                ->references('id')
                ->on('companies')
                ->onDelete('cascade')
                ->onUpdate('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('email_link_audits');
    }
};
