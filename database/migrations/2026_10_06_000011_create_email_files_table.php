<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('email_files')) {
            return;
        }

        Schema::create('email_files', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->unsignedInteger('company_id');
            // Null while an uploaded file is not yet on a message.
            $table->unsignedBigInteger('message_id')->nullable();
            // The mailbox that received it, or that it was uploaded to send from.
            $table->unsignedBigInteger('connection_id')->nullable();
            $table->unsignedInteger('uploaded_by')->nullable();
            // Provider's part id for a received attachment; metadata only.
            $table->string('part_id')->nullable();
            $table->string('filename');
            $table->string('mime_type')->nullable();
            $table->unsignedBigInteger('size_bytes')->nullable();
            $table->string('content_id')->nullable();
            $table->boolean('inline')->default(false);
            // Where the gateway put it, under the email-attachments prefix. Null until stored.
            $table->string('storage_key', 1024)->nullable();
            $table->string('storage_url', 2048)->nullable();
            // pending | clean | infected | unavailable
            $table->string('scan_status', 32)->default('pending');
            $table->string('error_code', 64)->nullable();
            $table->timestamps();

            $table->unique(['message_id', 'part_id'], 'email_files_message_part_unique');
            $table->index(['company_id', 'message_id'], 'email_files_company_message_index');

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
            $table->foreign('connection_id')
                ->references('id')
                ->on('email_connections')
                ->onDelete('set null')
                ->onUpdate('cascade');
            $table->foreign('uploaded_by')
                ->references('id')
                ->on('users')
                ->onDelete('set null')
                ->onUpdate('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('email_files');
    }
};
