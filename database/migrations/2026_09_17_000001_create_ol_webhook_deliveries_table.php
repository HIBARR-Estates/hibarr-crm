<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Durable outcome tracking for the OL webhook pipeline (DispatchOlWebhookJob).
 * One row per delivery attempt-set, denormalized off model_type/model_id/
 * event_type_slug/company_id so it stays queryable and meaningful even after
 * the source crm_events row is archived/deleted by ArchiveCrmEventsJob.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('ol_webhook_deliveries')) {
            return;
        }

        Schema::create('ol_webhook_deliveries', function (Blueprint $table) {
            $table->id();

            // Denormalized, unconstrained reference (matches the company_id
            // convention in email_delivery_logs) — no FK, so this audit trail
            // survives crm_events rows being archived/deleted independently
            // of whether they still exist.
            $table->unsignedBigInteger('crm_event_id')->nullable()->index();
            $table->char('crm_event_uuid', 36)->nullable()->index();

            $table->string('event_type_slug', 60)->index();
            $table->string('model_type')->nullable();
            $table->unsignedBigInteger('model_id')->nullable();
            $table->unsignedInteger('company_id')->nullable();

            // observer | backfill
            $table->string('origin', 20)->default('observer');

            // pending | sent | failed | exhausted | rejected
            $table->string('status', 20)->default('pending');

            $table->unsignedTinyInteger('attempts')->default(0);
            $table->text('last_error')->nullable();
            $table->timestamp('last_attempted_at')->nullable();
            $table->timestamp('delivered_at')->nullable();

            $table->timestamps();

            $table->index(['model_type', 'model_id', 'event_type_slug'], 'ol_wh_del_entity_slug');
            $table->index(['company_id', 'status'], 'ol_wh_del_company_status');
            $table->index(['status', 'origin'], 'ol_wh_del_status_origin');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ol_webhook_deliveries');
    }
};
