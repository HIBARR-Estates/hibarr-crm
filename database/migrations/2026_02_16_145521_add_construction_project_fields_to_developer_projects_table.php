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
        Schema::table('developer_projects', function (Blueprint $table) {
            // --- Links ---
            $table->string('google_drive_link', 500)->nullable()->after('project_location_id');
            $table->string('availability_link', 500)->nullable()->after('google_drive_link')
                ->comment('Link to Google Drive availability sheet');

            // --- Pricing ---
            $table->decimal('starting_price', 12, 2)->nullable()->after('availability_link');

            // --- Classification ---
            $table->json('primary_categories')->nullable()->after('starting_price')
                ->comment('Multi-select: residential, commercial');
            $table->string('title_deed_type')->nullable()->after('primary_categories');
            $table->json('unit_types')->nullable()->after('title_deed_type')
                ->comment('Multi-select: Apartment, Villa, etc.');
            $table->unsignedInteger('number_of_units')->nullable()->after('unit_types');
            $table->unsignedInteger('number_of_blocks')->nullable()->after('number_of_units');
            $table->decimal('project_total_area_sqm', 12, 2)->nullable()->after('number_of_blocks');

            // --- Construction ---
            $table->string('construction_status')->nullable()->after('project_total_area_sqm')
                ->comment('Pre-construction Phase, Active Construction, Post Construction, Complete');
            $table->date('completion_date')->nullable()->after('construction_status');
            $table->unsignedInteger('number_of_phases')->nullable()->after('completion_date');

            // --- Specs ---
            $table->string('furniture_package')->nullable()->after('number_of_phases')
                ->comment('Unfurnished, Part Furnished, White Goods Only, Fully Furnished');
            $table->boolean('rental_guarantee')->default(false)->after('furniture_package');

            // --- Payment Plan ---
            $table->json('payment_plan')->nullable()->after('rental_guarantee')
                ->comment('JSON: {enabled, downpayment_type, downpayment_value, period_months, interest_rate}');

            // --- Facilities ---
            $table->json('facilities')->nullable()->after('payment_plan')
                ->comment('JSON array of facility slugs');

            // --- Distances ---
            $table->json('distances')->nullable()->after('facilities')
                ->comment('JSON: {sea_km, hospital_km, market_km, school_km, airport_km, beach_km}');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('developer_projects', function (Blueprint $table) {
            $table->dropColumn([
                'google_drive_link',
                'availability_link',
                'starting_price',
                'primary_categories',
                'title_deed_type',
                'unit_types',
                'number_of_units',
                'number_of_blocks',
                'project_total_area_sqm',
                'construction_status',
                'completion_date',
                'number_of_phases',
                'furniture_package',
                'rental_guarantee',
                'payment_plan',
                'facilities',
                'distances',
            ]);
        });
    }
};
