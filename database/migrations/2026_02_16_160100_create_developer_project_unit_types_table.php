<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('developer_project_unit_types', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id');
            $table->unsignedBigInteger('developer_project_id');
            $table->string('reference_code', 50)->nullable();

            // Category & Type
            $table->string('primary_category', 30)->default('residential'); // residential | commercial
            $table->string('property_type', 50)->nullable(); // apartment, villa, shop, office, etc.
            $table->json('unit_style')->nullable(); // ["studio","penthouse","loft","garden_apartment","duplex","triplex"]
            $table->json('view_types')->nullable(); // ["sea_front","sea_view","mountain_view",...]
            $table->string('furniture_status', 30)->nullable(); // unfurnished, part_furnished, ...

            // Pricing
            $table->decimal('starting_price', 12, 2)->nullable();
            $table->string('currency', 5)->default('GBP'); // EUR, GBP, USD, TRY

            // Specifications
            $table->unsignedTinyInteger('bedrooms')->nullable();
            $table->unsignedTinyInteger('bathrooms')->nullable();
            $table->string('floor', 20)->nullable(); // "basement", "ground", "1"-"15+"
            $table->unsignedTinyInteger('floors_in_building')->nullable();
            $table->decimal('total_area_sqm', 10, 2)->nullable();
            $table->decimal('living_area_sqm', 10, 2)->nullable();
            $table->decimal('terrace_balcony_sqm', 10, 2)->nullable();
            $table->decimal('plot_size_sqm', 10, 2)->nullable();
            $table->date('completion_date')->nullable();

            // Features
            $table->json('outside_features')->nullable();
            $table->json('inside_features')->nullable();

            // Description
            $table->text('description')->nullable();

            // Legal
            $table->decimal('military_base_distance_km', 8, 2)->nullable();
            $table->boolean('has_restrictions')->default(false);
            $table->text('restriction_notes')->nullable();

            // Ordering
            $table->unsignedInteger('order')->default(0);

            $table->timestamps();
            $table->softDeletes();

            // Foreign keys
            $table->foreign('developer_project_id')
                ->references('id')->on('developer_projects')
                ->onDelete('cascade');

            $table->foreign('company_id')
                ->references('id')->on('companies')
                ->onDelete('cascade');

            // Indexes
            $table->index(['developer_project_id', 'primary_category'], 'dput_project_category_idx');
            $table->unique(['company_id', 'reference_code'], 'dput_company_ref_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('developer_project_unit_types');
    }
};
