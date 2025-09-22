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
        Schema::create('activity_response_retry_queue', function (Blueprint $table) {
            $table->id();
            $table->json('original_data'); // Store the original request data
            $table->json('original_headers')->nullable(); // Store original headers
            $table->string('channel')->nullable(); // Activity channel (email, whatsapp, etc.)
            $table->string('status')->default('pending'); // pending, processing, completed, failed
            $table->integer('attempts')->default(0); // Number of retry attempts
            $table->timestamp('last_attempt_at')->nullable(); // Last attempt timestamp
            $table->timestamp('next_retry_at')->nullable(); // Next retry scheduled time
            $table->timestamp('completed_at')->nullable(); // Completion timestamp
            $table->timestamp('failed_at')->nullable(); // Failure timestamp
            $table->json('last_response')->nullable(); // Last response received
            $table->text('error_message')->nullable(); // Error message if failed
            $table->timestamps();
            
            // Indexes for performance
            $table->index(['status', 'next_retry_at']);
            $table->index(['channel', 'status']);
            $table->index('created_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('activity_response_retry_queue');
    }
};
