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
        Schema::create('properties', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained('products')->onDelete('cascade');

            $table->enum('property_type', ['housing', 'land', 'commercial']);
            $table->enum('sale_type', ['for_sale', 'for_rent', 'daily_rental']);

            $table->decimal('price', 15, 2)->nullable();
            $table->decimal('dues', 15, 2)->nullable();
            $table->integer('minimal_rental_period')->nullable();
            $table->enum('rent_payment_interval', ['monthly', 'quarterly', 'yearly'])->nullable();

            $table->string('title_deed')->nullable();
            $table->boolean('open_to_trade')->default(false);
            $table->enum('status', ['available', 'sold', 'rented'])->default('available');

            $table->string('city')->nullable();
            $table->string('area')->nullable();
            $table->integer('rooms')->nullable();
            $table->integer('bedrooms')->nullable();
            $table->integer('bathrooms')->nullable();
            $table->integer('floor_number')->nullable();
            $table->integer('floors_in_building')->nullable();
            $table->integer('building_age')->nullable();
            $table->boolean('is_furnished')->default(false);
            $table->boolean('within_site')->default(false);

            $table->text('exterior_features')->nullable();
            $table->text('interior_features')->nullable();
            $table->text('location_features')->nullable();

            $table->string('title')->nullable();
            $table->text('description')->nullable();
            $table->string('video_url')->nullable();
            $table->string('tour_360_url')->nullable();

            $table->timestamps();
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
