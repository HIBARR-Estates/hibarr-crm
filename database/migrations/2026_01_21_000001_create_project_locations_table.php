<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * Creates the project_locations table which stores location configuration
     * for developer projects. Each location contains address details, nearby
     * attractions, infrastructure, and airport information used in expose PDFs.
     */
    public function up(): void
    {
        Schema::create('project_locations', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id');
            
            // Basic information
            $table->string('name');
            $table->text('description')->nullable();
            
            // Address stored as JSON: {street, city, state, country, postalCode?}
            $table->json('address')->nullable();
            
            // URL to map image for the location
            $table->string('map_url', 500)->nullable();
            
            // Attractions: [{name, content[], images: {primary, secondary}}]
            $table->json('attractions')->nullable();
            
            // Infrastructure: [{name, travelTimeInMin, image}]
            $table->json('infrastructure')->nullable();
            
            // Airports: [{name, travelTimeInMin, image}]
            $table->json('airports')->nullable();
            
            $table->timestamps();
            $table->softDeletes();
            
            // Foreign key to companies table for multi-tenancy
            $table->foreign('company_id')
                ->references('id')
                ->on('companies')
                ->onDelete('cascade');
            
            // Index for faster lookups by company
            $table->index('company_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('project_locations');
    }
};
