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
        Schema::create('api_tokens', function (Blueprint $table) {

            $table->id();
            $table->string('token', 64)->unique();
            $table->string('name'); 
            $table->json('permissions')->nullable();
            $table->boolean('revoked')->default(false);
            $table->timestamps();


            // TODO: Maintain a log of token usage (last used at, IP address, etc.)
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('api_tokens');
    }
};
