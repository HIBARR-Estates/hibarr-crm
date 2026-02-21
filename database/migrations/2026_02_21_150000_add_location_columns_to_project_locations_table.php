<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Add city, area, latitude, longitude columns to project_locations.
     *
     * These flat columns are used by the DeveloperProjectController for
     * basic location data, separate from the JSON address/attractions
     * fields used for expose PDF generation.
     */
    public function up(): void
    {
        Schema::table('project_locations', function (Blueprint $table) {
            $table->string('city')->nullable()->after('company_id');
            $table->string('area')->nullable()->after('city');
            $table->decimal('latitude', 10, 7)->nullable()->after('map_url');
            $table->decimal('longitude', 10, 7)->nullable()->after('latitude');
        });

        // Make name nullable since the developer project form doesn't submit it
        Schema::table('project_locations', function (Blueprint $table) {
            $table->string('name')->nullable()->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('project_locations', function (Blueprint $table) {
            $table->dropColumn(['city', 'area', 'latitude', 'longitude']);
            $table->string('name')->nullable(false)->change();
        });
    }
};
