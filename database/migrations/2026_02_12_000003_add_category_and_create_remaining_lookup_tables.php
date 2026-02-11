<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Add `category` column to property_types and create 9 additional
     * lookup tables so that ALL dropdown values are DB-driven.
     *
     * Existing 9 tables: property_types, property_sub_types, property_primary_categories,
     * property_view_types, property_title_deed_types, property_exterior_features,
     * property_interior_features, property_floor_types, property_deed_statuses.
     *
     * New tables created here:
     *   property_construction_statuses, property_occupancy_types, property_furniture_statuses,
     *   property_heating_types, property_cities, property_sale_types, property_statuses,
     *   property_location_features, property_add_ons
     *
     * Plus: property_types.category column for type→category mapping.
     */
    public function up(): void
    {
        // ── Add category column to property_types ──────────────────────
        if (Schema::hasTable('property_types') && !Schema::hasColumn('property_types', 'category')) {
            Schema::table('property_types', function (Blueprint $table) {
                $table->string('category')->nullable()->after('description')
                    ->comment('Primary category: residential, commercial, land');
                $table->index('category');
            });
        }

        // ── Helper: create a standard lookup table ─────────────────────
        $createLookup = function (string $tableName) {
            if (!Schema::hasTable($tableName)) {
                Schema::create($tableName, function (Blueprint $table) {
                    $table->id();
                    $table->unsignedInteger('company_id');
                    $table->string('name');
                    $table->string('label');
                    $table->text('description')->nullable();
                    $table->timestamps();

                    $table->unique(['company_id', 'name']);
                    $table->foreign('company_id')
                        ->references('id')->on('companies')
                        ->cascadeOnDelete();
                });
            }
        };

        $createLookup('property_construction_statuses');
        $createLookup('property_occupancy_types');
        $createLookup('property_furniture_statuses');
        $createLookup('property_heating_types');
        $createLookup('property_cities');
        $createLookup('property_sale_types');
        $createLookup('property_statuses');
        $createLookup('property_location_features');
        $createLookup('property_add_ons');
    }

    public function down(): void
    {
        // Drop new tables
        Schema::dropIfExists('property_add_ons');
        Schema::dropIfExists('property_location_features');
        Schema::dropIfExists('property_statuses');
        Schema::dropIfExists('property_sale_types');
        Schema::dropIfExists('property_cities');
        Schema::dropIfExists('property_heating_types');
        Schema::dropIfExists('property_furniture_statuses');
        Schema::dropIfExists('property_occupancy_types');
        Schema::dropIfExists('property_construction_statuses');

        // Remove category column
        if (Schema::hasTable('property_types') && Schema::hasColumn('property_types', 'category')) {
            Schema::table('property_types', function (Blueprint $table) {
                $table->dropIndex(['category']);
                $table->dropColumn('category');
            });
        }
    }
};
