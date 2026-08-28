<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_notification_bypasses', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('user_id');
            $table->string('notification_key', 128);
            $table->timestamps();

            $table->unique(['user_id', 'notification_key']);
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_notification_bypasses');
    }
};
