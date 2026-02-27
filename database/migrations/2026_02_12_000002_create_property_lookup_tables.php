<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Create 9 lookup tables for property configuration.
     *
     * Each table stores user-manageable options (per company) that were
     * previously hardcoded as constants in the Property model.
     *
     * All tables follow the same schema:
     *   id, company_id, name (unique per company), label, description, timestamps
     *
     * Ref: app/Services/PdfExpose/Configuration/property_config_models.tsx
     */
    public function up(): void
    {
        // 1. Property Types (Villa, Apartment, etc.)
        if (!Schema::hasTable('property_types')) {
            Schema::create('property_types', function (Blueprint $table) {
                $table->id();
                $table->unsignedInteger('company_id');
                $table->string('name');
                $table->string('label');
                $table->text('description')->nullable();
                $table->timestamps();

                $table->unique(['company_id', 'name']);
                $table->foreign('company_id')->references('id')->on('companies')->cascadeOnDelete();
            });
        }

        // 2. Property Sub Types / Unit Styles (Standard, Penthouse, Duplex, etc.)
        if (!Schema::hasTable('property_sub_types')) {
            Schema::create('property_sub_types', function (Blueprint $table) {
                $table->id();
                $table->unsignedInteger('company_id');
                $table->string('name');
                $table->string('label');
                $table->text('description')->nullable();
                $table->string('parent_type')->nullable()->comment('References property_types.name to associate subtypes with parent types');
                $table->timestamps();

                $table->unique(['company_id', 'name']);
                $table->foreign('company_id')->references('id')->on('companies')->cascadeOnDelete();
                $table->index('parent_type');
            });
        }

        // 3. Property Primary Categories (Residential, Commercial, Land)
        if (!Schema::hasTable('property_primary_categories')) {
            Schema::create('property_primary_categories', function (Blueprint $table) {
                $table->id();
                $table->unsignedInteger('company_id');
                $table->string('name');
                $table->string('label');
                $table->text('description')->nullable();
                $table->timestamps();

                $table->unique(['company_id', 'name']);
                $table->foreign('company_id')->references('id')->on('companies')->cascadeOnDelete();
            });
        }

        // 4. Property View Types (Sea Front, Mountain View, etc.)
        if (!Schema::hasTable('property_view_types')) {
            Schema::create('property_view_types', function (Blueprint $table) {
                $table->id();
                $table->unsignedInteger('company_id');
                $table->string('name');
                $table->string('label');
                $table->text('description')->nullable();
                $table->timestamps();

                $table->unique(['company_id', 'name']);
                $table->foreign('company_id')->references('id')->on('companies')->cascadeOnDelete();
            });
        }

        // 5. Property Title Deed Types (Turkish/British, Exchange, etc.)
        if (!Schema::hasTable('property_title_deed_types')) {
            Schema::create('property_title_deed_types', function (Blueprint $table) {
                $table->id();
                $table->unsignedInteger('company_id');
                $table->string('name');
                $table->string('label');
                $table->text('description')->nullable();
                $table->timestamps();

                $table->unique(['company_id', 'name']);
                $table->foreign('company_id')->references('id')->on('companies')->cascadeOnDelete();
            });
        }

        // 6. Property Exterior Features (Barbeque, Garden, Pool, etc.)
        if (!Schema::hasTable('property_exterior_features')) {
            Schema::create('property_exterior_features', function (Blueprint $table) {
                $table->id();
                $table->unsignedInteger('company_id');
                $table->string('name');
                $table->string('label');
                $table->text('description')->nullable();
                $table->timestamps();

                $table->unique(['company_id', 'name']);
                $table->foreign('company_id')->references('id')->on('companies')->cascadeOnDelete();
            });
        }

        // 7. Property Interior Features (Air Condition, Fireplace, etc.)
        if (!Schema::hasTable('property_interior_features')) {
            Schema::create('property_interior_features', function (Blueprint $table) {
                $table->id();
                $table->unsignedInteger('company_id');
                $table->string('name');
                $table->string('label');
                $table->text('description')->nullable();
                $table->timestamps();

                $table->unique(['company_id', 'name']);
                $table->foreign('company_id')->references('id')->on('companies')->cascadeOnDelete();
            });
        }

        // 8. Property Floor Types (Basement -1, Ground Floor, 1–15+)
        if (!Schema::hasTable('property_floor_types')) {
            Schema::create('property_floor_types', function (Blueprint $table) {
                $table->id();
                $table->unsignedInteger('company_id');
                $table->string('name');
                $table->string('label');
                $table->text('description')->nullable();
                $table->timestamps();

                $table->unique(['company_id', 'name']);
                $table->foreign('company_id')->references('id')->on('companies')->cascadeOnDelete();
            });
        }

        // 9. Property Deed Statuses (Owner Individual, Owner Shared, etc.)
        if (!Schema::hasTable('property_deed_statuses')) {
            Schema::create('property_deed_statuses', function (Blueprint $table) {
                $table->id();
                $table->unsignedInteger('company_id');
                $table->string('name');
                $table->string('label');
                $table->text('description')->nullable();
                $table->timestamps();

                $table->unique(['company_id', 'name']);
                $table->foreign('company_id')->references('id')->on('companies')->cascadeOnDelete();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $tables = [
            'property_deed_statuses',
            'property_floor_types',
            'property_interior_features',
            'property_exterior_features',
            'property_title_deed_types',
            'property_view_types',
            'property_primary_categories',
            'property_sub_types',
            'property_types',
        ];

        foreach ($tables as $table) {
            Schema::dropIfExists($table);
        }
    }
};
