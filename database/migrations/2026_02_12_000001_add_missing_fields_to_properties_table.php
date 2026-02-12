<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Add missing columns to the properties table as defined in property_form.tsx:
     *
     * - total_area_sqm, plot_size_sqm: physical area measurements
     * - floor: textual floor designation (e.g. "Ground Floor", "Basement -1")
     * - has_restrictions, restriction_notes: legal restriction flags
     * - deed_status: dropdown (owner_individual, owner_shared, developer_ready, no_deed)
     * - price_to_owner, hibarr_price, commission_agreement_signed: financial fields
     * - general_notes: free-text notes
     */
    public function up(): void
    {
        Schema::table('properties', function (Blueprint $table) {
            // Physical Attributes
            if (!Schema::hasColumn('properties', 'total_area_sqm')) {
                $table->decimal('total_area_sqm', 10, 2)->nullable()->after('land_size');
            }

            if (!Schema::hasColumn('properties', 'plot_size_sqm')) {
                $table->decimal('plot_size_sqm', 10, 2)->nullable()->after('total_area_sqm');
            }

            if (!Schema::hasColumn('properties', 'floor')) {
                $table->string('floor')->nullable()->after('rooms');
            }

            // Legal Info
            if (!Schema::hasColumn('properties', 'has_restrictions')) {
                $table->boolean('has_restrictions')->default(false)->after('allow_hangiev');
            }

            if (!Schema::hasColumn('properties', 'restriction_notes')) {
                $table->text('restriction_notes')->nullable()->after('has_restrictions');
            }

            // Deed Status (dropdown)
            if (!Schema::hasColumn('properties', 'deed_status')) {
                $table->string('deed_status')->nullable()->after('restriction_notes');
            }

            // Financial Information (direct columns for queryability)
            if (!Schema::hasColumn('properties', 'price_to_owner')) {
                $table->decimal('price_to_owner', 15, 2)->nullable()->after('deed_status');
            }

            if (!Schema::hasColumn('properties', 'hibarr_price')) {
                $table->decimal('hibarr_price', 15, 2)->nullable()->after('price_to_owner');
            }

            if (!Schema::hasColumn('properties', 'commission_agreement_signed')) {
                $table->boolean('commission_agreement_signed')->default(false)->after('hibarr_price');
            }

            // Notes
            if (!Schema::hasColumn('properties', 'general_notes')) {
                $table->text('general_notes')->nullable()->after('commission_agreement_signed');
            }
        });

        // Add index on deed_status for filtering
        Schema::table('properties', function (Blueprint $table) {
            if (!$this->indexExists('properties', 'properties_deed_status_index')) {
                $table->index('deed_status');
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
                'total_area_sqm',
                'plot_size_sqm',
                'floor',
                'has_restrictions',
                'restriction_notes',
                'deed_status',
                'price_to_owner',
                'hibarr_price',
                'commission_agreement_signed',
                'general_notes',
            ];

            // Drop index first
            if ($this->indexExists('properties', 'properties_deed_status_index')) {
                $table->dropIndex('properties_deed_status_index');
            }

            foreach ($columns as $column) {
                if (Schema::hasColumn('properties', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }

    /**
     * Check if an index exists on the given table.
     */
    private function indexExists(string $table, string $indexName): bool
    {
        $indexes = Schema::getIndexes($table);
        foreach ($indexes as $index) {
            if ($index['name'] === $indexName) {
                return true;
            }
        }
        return false;
    }
};
