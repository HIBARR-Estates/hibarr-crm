<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('deal_exposes')) {
            return;
        }

        Schema::create('deal_exposes', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('company_id');
            $table->unsignedBigInteger('deal_id');
            // Denormalised from the deal so the Lead tab can roll every deal's
            // exposes up in one query instead of joining through deals.
            $table->unsignedBigInteger('lead_id')->nullable();

            // linked = pulled from a project exposé (expose_snapshots),
            // manual = a document the agent attached themselves.
            $table->string('source', 16)->default('manual');
            $table->unsignedBigInteger('expose_snapshot_id')->nullable();

            $table->string('title');
            $table->string('source_label')->nullable();
            $table->decimal('amount', 15, 2)->nullable();

            // not_sent | shown | accepted | not_accepted
            $table->string('status', 24)->default('not_sent');
            $table->timestamp('status_changed_at')->nullable();

            // Manual uploads only — mirrors DealFile's external/local split.
            $table->string('filename')->nullable();
            $table->string('external_url')->nullable();
            $table->string('object_path')->nullable();
            $table->unsignedBigInteger('size')->nullable();

            $table->unsignedBigInteger('added_by')->nullable();
            $table->timestamps();

            $table->index(['company_id', 'deal_id', 'created_at'], 'deal_exposes_company_deal_created_idx');
            $table->index(['company_id', 'lead_id', 'created_at'], 'deal_exposes_company_lead_created_idx');
            $table->index(['company_id', 'status'], 'deal_exposes_company_status_idx');

            $table->foreign('deal_id')->references('id')->on('deals')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('deal_exposes');
    }
};
