<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Per-message delivery log for every email that leaves the app through the
 * uns-routing mailer. Records which system actually delivered it (UNS/Plunk
 * or the SMTP/PHP fallback) and what that system answered, so a failed
 * automation email can be diagnosed from inside the CRM instead of the
 * laravel.log file on the server.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('email_delivery_logs')) {
            return;
        }

        Schema::create('email_delivery_logs', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id')->nullable();

            $table->string('recipient')->nullable();
            $table->string('subject')->nullable();
            $table->string('plunk_template_id')->nullable();

            // 'uns' when UNS/Plunk accepted the message, 'smtp' when the PHP
            // SMTP mailer delivered it (either by design or as UNS fallback).
            $table->string('system', 20)->default('smtp');
            $table->boolean('uns_attempted')->default(false);
            $table->string('status', 20)->default('sent'); // sent | failed

            $table->unsignedSmallInteger('response_status')->nullable();
            $table->text('response_body')->nullable();
            $table->text('error')->nullable();
            $table->string('fallback_reason')->nullable();

            // Where the mail came from: source ('deal_automation', ...),
            // automation_id, deal_id, lead_id, correlation_id.
            $table->json('context')->nullable();
            $table->uuid('correlation_id')->nullable();

            $table->timestamp('sent_at')->useCurrent();
            $table->timestamps();

            $table->index('company_id');
            $table->index('correlation_id');
            $table->index(['status', 'sent_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('email_delivery_logs');
    }
};
