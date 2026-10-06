<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('email_user_reads')) {
            return;
        }

        // One row = this user has opened this message. Per user, never shared,
        // and never written back to the provider as \Seen.
        Schema::create('email_user_reads', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id');
            $table->unsignedInteger('user_id');
            $table->unsignedBigInteger('message_id');
            $table->timestamp('read_at')->nullable();

            // Keyed on the message, not the copy: a second copy or a repeated sync cannot make it unread again.
            $table->unique(['user_id', 'message_id'], 'email_user_reads_user_message_unique');
            $table->index(['message_id'], 'email_user_reads_message_index');

            $table->foreign('company_id')
                ->references('id')
                ->on('companies')
                ->onDelete('cascade')
                ->onUpdate('cascade');
            $table->foreign('user_id')
                ->references('id')
                ->on('users')
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
        Schema::dropIfExists('email_user_reads');
    }
};
