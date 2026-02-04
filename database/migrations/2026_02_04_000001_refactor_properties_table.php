<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * This migration refactors the properties table to support:
     * - Dynamic reference codes (computed from type/subtype/rooms/id)
     * - Direct location relationships (project_location_id)
     * - Publishing workflow (is_published, published_at)
     * - Responsible agent & creator tracking
     * - Enhanced property details (unit_style, construction_status, etc.)
     * - Owner information (JSON for flexibility)
     * - Land-specific details (JSON for flexibility)
     */
    public function up(): void
    {
        Schema::table('properties', function (Blueprint $table) {
            // Make title nullable (reference code will be computed dynamically)
            $table->string('title')->nullable()->change();
            
            // Make description nullable
            $table->text('description')->nullable()->change();

            // ================================================================
            // Core Classification Fields
            // ================================================================
            
            // Primary category: residential, commercial, land
            $table->string('primary_category')->nullable()->after('property_type');
            
            // Unit style: studio, penthouse, loft, garden, duplex, triplex, standard
            $table->string('unit_style')->nullable()->after('primary_category');
            
            // Construction status: off_plan, under_construction, completed_new, resale, ruin_renovation
            $table->string('construction_status')->nullable()->after('unit_style');
            
            // View types (multi-select): sea_front, sea_view, mountain_view, pool_view, garden_view, city_view
            $table->json('view_types')->nullable()->after('construction_status');
            
            // Current occupancy: owner_occupied, tenant, vacant
            $table->string('current_occupancy')->nullable()->after('furniture_status');

            // ================================================================
            // Location - Direct Relationship
            // ================================================================
            
            // Direct link to project_locations table (priority over developer_project's location)
            $table->foreignId('project_location_id')
                ->nullable()
                ->after('developer_project_id')
                ->constrained('project_locations')
                ->nullOnDelete();

            // ================================================================
            // Publishing & Ownership
            // ================================================================
            
            // Publishing workflow
            $table->boolean('is_published')->default(false)->after('status');
            $table->timestamp('published_at')->nullable()->after('is_published');
            
            // Creator tracking (who added the property)
            $table->foreignId('added_by')
                ->nullable()
                ->after('product_id')
                ->constrained('users')
                ->nullOnDelete();
            
            // Responsible agent (defaults to creator, can be changed)
            $table->foreignId('responsible_agent_id')
                ->nullable()
                ->after('added_by')
                ->constrained('users')
                ->nullOnDelete();

            // ================================================================
            // Swap Feature
            // ================================================================
            
            $table->boolean('open_to_swap')->default(false)->after('furniture_status');
            $table->text('swap_notes')->nullable()->after('open_to_swap');

            // ================================================================
            // Distance Information
            // ================================================================
            
            // Distances in JSON: {sea_km, hospital_km, market_km, schools_km}
            $table->json('distances')->nullable()->after('map');

            // ================================================================
            // Area Measurements
            // ================================================================
            
            $table->decimal('living_area_sqm', 10, 2)->nullable()->after('land_size');
            $table->decimal('terrace_area_sqm', 10, 2)->nullable()->after('living_area_sqm');
            $table->date('completion_date')->nullable()->after('building_age');

            // ================================================================
            // Features (Restructured)
            // ================================================================
            
            // Outside features: barbeque, bounding_wall, double_glazing, car_park_closed, garage, etc.
            $table->json('outside_features')->nullable()->after('location_features');
            
            // Inside features: air_condition, balcony, bath_tube, blind, built_in_kitchen, etc.
            $table->json('inside_features')->nullable()->after('outside_features');

            // ================================================================
            // Internal/Restricted Information (JSON for flexibility)
            // ================================================================
            
            // Owner info: {full_name, telephone, email, key_holder_name, key_holder_phone}
            $table->json('owner_info')->nullable()->after('add_ons');
            
            // Legal info: {military_distance, has_restrictions, restriction_notes, deed_status, vat_paid, vat_amount, trafo_paid, stopaj_paid}
            $table->json('legal_info')->nullable()->after('owner_info');
            
            // Financial info: {owner_price, owner_price_currency, hibarr_price, hibarr_price_currency, commission_signed}
            $table->json('financial_info')->nullable()->after('legal_info');
            
            // Documents checklist: {search_document, sales_agreement, title_deed_copy, owner_passport, site_plan}
            $table->json('documents_checklist')->nullable()->after('financial_info');

            // ================================================================
            // External Publishing Permissions
            // ================================================================
            
            $table->boolean('allow_101evler')->default(false)->after('documents_checklist');
            $table->boolean('allow_hangiev')->default(false)->after('allow_101evler');

            // ================================================================
            // Land-Specific Details (JSON for flexibility)
            // ================================================================
            
            // land_details: {land_type, price_per_donum, price_per_donum_currency, total_donums, development_rate_percent, max_floor_permission, location_features: []}
            $table->json('land_details')->nullable()->after('allow_hangiev');

            // ================================================================
            // Indexes for Performance
            // ================================================================
            
            $table->index('primary_category');
            $table->index('unit_style');
            $table->index('construction_status');
            $table->index('is_published');
            $table->index(['is_published', 'status']);
            $table->index('current_occupancy');
        });

        // ================================================================
        // Backfill existing data
        // ================================================================
        
        // Set all existing properties as published (backward compatibility)
        DB::table('properties')
            ->whereNull('is_published')
            ->orWhere('is_published', false)
            ->update([
                'is_published' => true,
                'published_at' => DB::raw('created_at'),
            ]);

        // Backfill added_by from products.added_by
        DB::statement('
            UPDATE properties p
            JOIN products prod ON p.product_id = prod.id
            SET p.added_by = prod.added_by
            WHERE p.added_by IS NULL
        ');

        // Set responsible_agent_id to added_by if not set
        DB::statement('
            UPDATE properties
            SET responsible_agent_id = added_by
            WHERE responsible_agent_id IS NULL AND added_by IS NOT NULL
        ');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('properties', function (Blueprint $table) {
            // Drop indexes first
            $table->dropIndex(['primary_category']);
            $table->dropIndex(['unit_style']);
            $table->dropIndex(['construction_status']);
            $table->dropIndex(['is_published']);
            $table->dropIndex(['is_published', 'status']);
            $table->dropIndex(['current_occupancy']);

            // Drop foreign key constraints
            $table->dropConstrainedForeignId('project_location_id');
            $table->dropConstrainedForeignId('added_by');
            $table->dropConstrainedForeignId('responsible_agent_id');

            // Drop columns
            $table->dropColumn([
                'primary_category',
                'unit_style',
                'construction_status',
                'view_types',
                'current_occupancy',
                'is_published',
                'published_at',
                'open_to_swap',
                'swap_notes',
                'distances',
                'living_area_sqm',
                'terrace_area_sqm',
                'completion_date',
                'outside_features',
                'inside_features',
                'owner_info',
                'legal_info',
                'financial_info',
                'documents_checklist',
                'allow_101evler',
                'allow_hangiev',
                'land_details',
            ]);

            // Revert title to non-nullable (may fail if null values exist)
            $table->string('title')->nullable(false)->change();
            $table->text('description')->nullable(false)->change();
        });
    }
};
