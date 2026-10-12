<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('email_connections')) {
            return;
        }

        Schema::create('email_connections', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->unsignedInteger('company_id');
            $table->unsignedInteger('user_id');
            $table->string('provider', 32);
            $table->string('identity_email');
            $table->string('from_email');
            $table->string('reply_to_email')->nullable();
            // Encrypted JSON (model cast). Never store provider secrets in plaintext.
            $table->text('credentials')->nullable();
            $table->string('status', 32)->default('active');
            $table->timestamp('sync_stopped_at')->nullable();
            $table->json('checkpoint')->nullable();
            $table->timestamp('last_sync_at')->nullable();
            $table->string('last_error_code', 64)->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'identity_email'], 'email_connections_user_identity_unique');
            $table->index(['company_id', 'status'], 'email_connections_company_status_index');

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
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('email_connections');
    }
};
