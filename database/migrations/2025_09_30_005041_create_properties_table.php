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
        // Drop the existing properties table if it exists
        Schema::dropIfExists('properties');

        // No use of enums here, and just use strings and JSON arrays, to ensure extensibility. The validation on code will ensure conformity to enums

        // Create the new properties table based on Property.tsx specification
        Schema::create('properties', function (Blueprint $table) {
            $table->id();
            
            // Foreign key to products table - using unsignedInteger to match products.id type
            $table->unsignedInteger('product_id')->index('properties_product_id_foreign');
            $table->foreign(['product_id'])->references(['id'])->on('products')->onUpdate('CASCADE')->onDelete('CASCADE');

            // Core property fields
            $table->string('property_type'); // PropertyType enum as string
            $table->string('sale_type'); // TransactionType enum as string (renamed from transactionType)
            
            // Pricing and rental information
            $table->decimal('price', 15, 2)->nullable();
            $table->string('minimal_rental_period')->nullable(); // e.g., "6 months", "1 year"
            $table->string('rent_payment_interval')->nullable(); // e.g., "monthly", "yearly"
            
            // Title deed information
            $table->string('title_deed_type')->nullable(); // TypeTitleDeed enum as string
            $table->string('title_deed_stage')->nullable(); // TypeTitleDeedStage enum as string
            
            // Status and location
            $table->string('status')->default('Available'); // Status enum as string
            $table->string('city');
            $table->text('map')->nullable(); // Google Maps URL or coordinates
            $table->string('area'); // e.g., "Downtown", "Suburbs"
            
            // Size and room information
            $table->decimal('land_size', 10, 2)->nullable(); // in square meters
            $table->string('living_room')->nullable(); // dropdown value
            $table->string('bedrooms')->nullable(); // dropdown value  
            $table->integer('bathrooms')->nullable(); // dropdown value
            
            // Building information
            $table->integer('floor_number')->nullable();
            $table->integer('floors_in_building')->nullable();
            $table->integer('building_age')->nullable();
            
            // Furniture and site information
            $table->string('furniture_status')->nullable(); // FurnitureStatus enum as string
            $table->boolean('within_site')->default(false); // isThisResidenceWithinASite
            
            // Features as JSON arrays
            $table->json('exterior_features')->nullable(); // ExteriorFeature[] as JSON
            $table->json('interior_features')->nullable(); // InteriorFeature[] as JSON
            $table->json('location_features')->nullable(); // LocationFeature[] as JSON
            
            // Content fields
            $table->string('title');
            $table->text('description');
            $table->string('video_url')->nullable();
            $table->string('tour_360_url')->nullable(); // "360TourUrl"
            
            // Media and add-ons as JSON arrays
            $table->json('photos'); // string[] of photo URLs
            $table->json('add_ons')->nullable(); // string[] e.g., ["Furniture", "Appliances"]
            
            $table->timestamps();
            
            // Indexes for better performance
            $table->index(['property_type', 'sale_type']);
            $table->index(['status', 'city']);
            $table->index('price');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('properties');
    }
};
