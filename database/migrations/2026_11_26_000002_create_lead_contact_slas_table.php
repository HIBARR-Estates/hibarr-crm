<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * One row per lead entry that carried a first-contact SLA: the clock, who it runs for, and how it
     * ended. The clock starts when the lead has an owner (`awaiting_owner` until then), counts only
     * the channel's working hours, and ends at the first outbound call, email or WhatsApp message.
     * A row is never deleted when it ends, so the outcome stays on record.
     */
    public function up(): void
    {
        Schema::create('lead_contact_slas', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id')->index();
            $table->unsignedInteger('lead_id');
            $table->unsignedBigInteger('lead_entry_id')->unique();
            $table->unsignedInteger('owner_user_id')->nullable()->index();

            // awaiting_owner | running | met
            $table->string('status', 16)->default('awaiting_owner');

            // The SLA as it applied to this entry.
            $table->unsignedInteger('first_contact_seconds');
            $table->string('recommended_method', 16)->nullable();
            $table->json('window')->nullable();

            $table->timestamp('started_at')->nullable();
            $table->timestamp('due_at')->nullable();
            // Set when the deadline passed with no contact, at the moment it passed.
            $table->timestamp('breached_at')->nullable();

            // How it ended.
            $table->timestamp('contacted_at')->nullable();
            $table->string('contact_method', 16)->nullable();
            $table->unsignedInteger('contacted_by_user_id')->nullable();
            $table->boolean('used_recommended_method')->nullable();
            $table->unsignedInteger('elapsed_working_seconds')->nullable();
            $table->boolean('met_in_time')->nullable();

            $table->timestamps();

            $table->index(['status', 'due_at']);
            $table->index(['lead_id', 'status']);
            $table->foreign('lead_id')->references('id')->on('leads')->onDelete('cascade');
            $table->foreign('lead_entry_id')->references('id')->on('lead_entries')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lead_contact_slas');
    }
};
