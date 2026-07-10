<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('lead_flight_itineraries', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('lead_id');
            $table->foreign('lead_id')->references('id')->on('leads')->onDelete('cascade');
            $table->foreignId('deal_id')->nullable()->constrained('deals')->nullOnDelete();
            $table->enum('direction', ['arrival', 'departure']);
            $table->string('airport_name')->nullable();
            $table->string('flight_number')->nullable();
            $table->dateTime('flight_date')->nullable();
            $table->string('status')->default('not arrived'); // arrived/not arrived, left/still on the island
            $table->boolean('is_transfer_required')->default(false);
            $table->string('ticket_image_url')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('lead_flight_itineraries');
    }
};
