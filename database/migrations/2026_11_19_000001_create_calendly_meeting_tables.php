<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // The booking links an admin offers in the schedule-meeting modal.
        Schema::create('calendly_meeting_links', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id')->index();
            $table->string('name', 120);
            $table->string('description', 255)->nullable();
            // The plain Calendly scheduling link. Lead/deal details are added
            // when the modal opens it, never stored here.
            $table->string('url', 500);
            // Meeting type given to the meeting created from a booking.
            $table->unsignedBigInteger('meeting_type_id')->nullable();
            // Roles that see this link in the modal. Empty/null = every role.
            $table->json('role_ids')->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });

        // One row per company: where Calendly sends bookings, and the key used
        // to check a delivery really came from Calendly.
        Schema::create('calendly_webhook_settings', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id')->unique();
            $table->string('webhook_token', 64)->unique();
            // Encrypted (see the model cast). Null until the admin adds it.
            $table->text('signing_key')->nullable();
            $table->timestamp('last_received_at')->nullable();
            $table->timestamps();
        });

        // Calendly retries deliveries and sends a cancel for a reschedule, so
        // each booking is remembered by its invitee to stay idempotent.
        Schema::create('calendly_bookings', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id')->index();
            $table->unsignedBigInteger('calendly_meeting_link_id')->nullable();
            // What the meeting was booked for ('lead' or 'deal') — kept so a
            // reschedule, which may arrive without the link's tag, still knows.
            $table->string('record_type', 10)->nullable();
            $table->unsignedBigInteger('record_id')->nullable();
            $table->string('invitee_uri', 255)->unique();
            $table->string('event_uri', 255)->nullable();
            $table->unsignedBigInteger('follow_up_id')->nullable()->index();
            $table->string('status', 20)->default('booked');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('calendly_bookings');
        Schema::dropIfExists('calendly_webhook_settings');
        Schema::dropIfExists('calendly_meeting_links');
    }
};
