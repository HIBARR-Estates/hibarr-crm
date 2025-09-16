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
        // Check if the required tables exist
        if (!Schema::hasTable('deals')) {
            throw new \Exception('The deals table does not exist. Please ensure the main application migrations have been run first.');
        }
        
        if (!Schema::hasTable('users')) {
            throw new \Exception('The users table does not exist. Please ensure the main application migrations have been run first.');
        }

        Schema::create('deal_watchers', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('deal_id');  // deals.id is bigint unsigned
            $table->unsignedInteger('user_id');     // users.id is int unsigned
            $table->timestamps();

            $table->foreign('deal_id')->references('id')->on('deals')->onDelete('cascade');
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            
            // Prevent duplicate entries
            $table->unique(['deal_id', 'user_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('deal_watchers');
    }
};
