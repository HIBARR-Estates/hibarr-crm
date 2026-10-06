<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('email_record_links')) {
            return;
        }

        Schema::create('email_record_links', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id');
            $table->unsignedBigInteger('conversation_id');
            // lead | deal
            $table->string('linkable_type', 32);
            $table->unsignedBigInteger('linkable_id');
            $table->unsignedInteger('linked_by')->nullable();
            $table->timestamp('linked_at')->nullable();
            $table->timestamps();

            $table->unique(['conversation_id', 'linkable_type', 'linkable_id'], 'email_record_links_conversation_record_unique');
            $table->index(['company_id', 'linkable_type', 'linkable_id'], 'email_record_links_company_record_index');

            $table->foreign('company_id')
                ->references('id')
                ->on('companies')
                ->onDelete('cascade')
                ->onUpdate('cascade');
            $table->foreign('conversation_id')
                ->references('id')
                ->on('email_conversations')
                ->onDelete('cascade')
                ->onUpdate('cascade');
            $table->foreign('linked_by')
                ->references('id')
                ->on('users')
                ->onDelete('set null')
                ->onUpdate('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('email_record_links');
    }
};
