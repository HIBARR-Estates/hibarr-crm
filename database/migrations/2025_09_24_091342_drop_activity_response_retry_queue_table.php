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
        Schema::dropIfExists('activity_response_retry_queue');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::create('activity_response_retry_queue', function (Blueprint $table) {
            $table->id();
            $table->json('original_data');
            $table->json('original_headers');
            $table->string('channel')->nullable();
            $table->string('status')->default('pending');
            $table->integer('attempts')->default(0);
            $table->timestamp('last_attempt_at')->nullable();
            $table->timestamp('next_retry_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('failed_at')->nullable();
            $table->json('last_response')->nullable();
            $table->text('error_message')->nullable();
            $table->timestamps();
        });
    }
};
