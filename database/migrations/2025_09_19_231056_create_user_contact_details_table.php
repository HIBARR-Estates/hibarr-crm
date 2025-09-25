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
        Schema::create('user_contact_details', function (Blueprint $table) {
            
            $table->id();
            $table->unsignedInteger('user_id');
            $table->string('telegram_chat_id')->nullable();
            $table->string('telegram_username')->nullable();
            $table->string('whatsapp_username')->nullable(); //probably phone number
            $table->string('instagram_username')->nullable();
            // relationships
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->unique(['user_id', 'telegram_chat_id'], 'user_telegram_unique');
            $table->unique(['user_id', 'telegram_username'], 'user_telegram_username_unique');
            $table->unique(['user_id', 'whatsapp_username'], 'user_whatsapp_username_unique');
            $table->unique(['user_id', 'instagram_username'], 'user_instagram_username_unique');
            // timestamps
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('user_contact_details');
    }
};
