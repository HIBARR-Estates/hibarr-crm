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

        Schema::create('property_assets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('property_id')->constrained('properties')->onDelete('cascade');
            $table->integer('company_id')->unsigned()->nullable();
            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade')->onUpdate('cascade');
            $table->string('name'); // Asset name/title
            $table->enum('asset_type', ['image', 'video', 'video_url', 'tour_360_url'])->default('image');
            $table->string('file_path')->nullable(); // For uploaded files
            $table->string('external_url')->nullable(); // For external URLs (video, 360 tours)
            $table->string('mime_type')->nullable();
            $table->unsignedBigInteger('file_size')->nullable(); // In bytes
            $table->json('tags')->nullable(); // ['hero', 'facilities', 'features', etc.]
            $table->json('metadata')->nullable(); // Additional metadata (dimensions, duration, etc.)
            $table->integer('order')->default(0); // For manual sorting
            $table->timestamps();
            $table->softDeletes(); // Soft delete support

            // Indexes
            $table->index(['property_id', 'asset_type']);
            $table->index(['property_id', 'created_at']);
            $table->index('company_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('property_assets');
    }
};
