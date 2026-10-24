<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('audit_logs')) {
            return;
        }

        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            // Plain ids, no foreign keys: an audit row must outlive the company,
            // user and record it describes, and must never block their deletion.
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('user_id')->nullable();
            // Snapshot of who acted, so the row still reads after the user is gone.
            $table->string('user_name')->nullable();
            // created | updated | deleted | restored | login | logout | login_failed | password_reset
            $table->string('event', 32);
            $table->string('auditable_type');
            $table->string('auditable_id', 64)->nullable();
            $table->string('auditable_label')->nullable();
            $table->json('old_values')->nullable();
            $table->json('new_values')->nullable();
            // web | api | console | queue
            $table->string('source', 16)->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent', 512)->nullable();
            $table->string('http_method', 10)->nullable();
            // Request URL (no query string), artisan command or queued job that made the change.
            $table->string('origin', 2048)->nullable();
            $table->timestamp('created_at')->nullable();

            $table->index(['company_id', 'created_at'], 'audit_logs_company_created_index');
            $table->index(['company_id', 'user_id', 'created_at'], 'audit_logs_company_user_index');
            $table->index(['company_id', 'auditable_type', 'auditable_id'], 'audit_logs_company_record_index');
            $table->index(['company_id', 'event'], 'audit_logs_company_event_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
    }
};
