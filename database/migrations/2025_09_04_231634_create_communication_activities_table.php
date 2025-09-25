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
        Schema::create('communication_activities', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedBigInteger('deal_id')->nullable();
            $table->unsignedInteger('lead_id')->nullable();
            $table->enum('channel_type', ['email', 'whatsapp', 'instagram', 'telegram']);
            $table->text('message_content');
            $table->json('sender_info');
            $table->timestamp('timestamp');
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade')->onUpdate('cascade');
            $table->foreign('deal_id')->references('id')->on('deals')->onDelete('cascade')->onUpdate('cascade');
            $table->foreign('lead_id')->references('id')->on('leads')->onDelete('cascade')->onUpdate('cascade');

            $table->index(['deal_id', 'channel_type']);
            $table->index(['lead_id', 'channel_type']);
            $table->index(['timestamp']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('communication_activities');
    }
}; 