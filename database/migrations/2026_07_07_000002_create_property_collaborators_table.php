<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('property_collaborators', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('property_id');
            $table->unsignedInteger('user_id');
            $table->timestamp('granted_at');
            $table->string('granted_via', 30)->default('access_request');
            $table->unsignedInteger('granted_by')->nullable();
            $table->timestamp('revoked_at')->nullable();
            $table->unsignedInteger('revoked_by')->nullable();
            $table->timestamps();

            $table->foreign('property_id')->references('id')->on('properties')->cascadeOnDelete();
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('granted_by')->references('id')->on('users')->nullOnDelete();
            $table->foreign('revoked_by')->references('id')->on('users')->nullOnDelete();

            $table->unique(['property_id', 'user_id']);
            $table->index(['property_id', 'revoked_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('property_collaborators');
    }
};
