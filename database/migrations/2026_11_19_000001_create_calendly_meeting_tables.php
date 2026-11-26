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
            // The plain Calendly scheduling link. The contact's details and the
            // guests are added when the modal opens it, never stored here.
            $table->string('url', 500);
            // Roles that see this link in the modal. Empty/null = every role.
            $table->json('role_ids')->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('calendly_meeting_links');
    }
};
