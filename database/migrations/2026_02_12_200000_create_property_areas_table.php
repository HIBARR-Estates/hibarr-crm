<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Create the property_areas table.
     *
     * Each area belongs to a city (property_cities) and a company.
     * This enables city→area cascading dropdowns in the property form.
     */
    public function up(): void
    {
        if (!Schema::hasTable('property_areas')) {
            Schema::create('property_areas', function (Blueprint $table) {
                $table->id();
                $table->unsignedInteger('company_id');
                $table->unsignedBigInteger('city_id');
                $table->string('name');
                $table->string('label');
                $table->text('description')->nullable();
                $table->timestamps();

                $table->unique(['company_id', 'name']);
                $table->index(['company_id', 'city_id']);
                $table->foreign('company_id')->references('id')->on('companies')->cascadeOnDelete();
                $table->foreign('city_id')->references('id')->on('property_cities')->cascadeOnDelete();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('property_areas');
    }
};
