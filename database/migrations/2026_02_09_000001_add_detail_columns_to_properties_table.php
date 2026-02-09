<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Add missing columns used by the property wizard:
     * - rooms, gross_sqm, balcony_count, balcony_net_sqm, heating_type (PropertyDetailsStep)
     * - address, latitude, longitude (LocationStep)
     */
    public function up(): void
    {
        Schema::table('properties', function (Blueprint $table) {
            if (!Schema::hasColumn('properties', 'rooms')) {
                $table->unsignedInteger('rooms')->nullable()->after('bathrooms');
            }

            if (!Schema::hasColumn('properties', 'gross_sqm')) {
                $table->decimal('gross_sqm', 10, 2)->nullable()->after('living_area_sqm');
            }

            if (!Schema::hasColumn('properties', 'balcony_count')) {
                $table->unsignedInteger('balcony_count')->nullable()->after('floors_in_building');
            }

            if (!Schema::hasColumn('properties', 'balcony_net_sqm')) {
                $table->decimal('balcony_net_sqm', 10, 2)->nullable()->after('balcony_count');
            }

            if (!Schema::hasColumn('properties', 'heating_type')) {
                $table->string('heating_type')->nullable()->after('furniture_status');
            }

            if (!Schema::hasColumn('properties', 'address')) {
                $table->text('address')->nullable()->after('area');
            }

            if (!Schema::hasColumn('properties', 'latitude')) {
                $table->decimal('latitude', 10, 8)->nullable()->after('address');
            }

            if (!Schema::hasColumn('properties', 'longitude')) {
                $table->decimal('longitude', 11, 8)->nullable()->after('latitude');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('properties', function (Blueprint $table) {
            $columns = [
                'rooms',
                'gross_sqm',
                'balcony_count',
                'balcony_net_sqm',
                'heating_type',
                'address',
                'latitude',
                'longitude',
            ];

            foreach ($columns as $column) {
                if (Schema::hasColumn('properties', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
