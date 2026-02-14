<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Converts properties.unit_style from a single-select string column
 * to a multi-select JSON array column per PRD requirements.
 *
 * Also renames 'garden' → 'garden_apartment' and nullifies 'standard'.
 */
return new class extends Migration
{
    public function up(): void
    {
        // 1. Drop the existing index on unit_style
        Schema::table('properties', function (Blueprint $table) {
            $sm = Schema::getConnection()->getDoctrineSchemaManager();
            $indexes = $sm->listTableIndexes('properties');
            if (isset($indexes['properties_unit_style_index'])) {
                $table->dropIndex('properties_unit_style_index');
            }
        });

        // 2. Migrate existing string data to JSON arrays
        // Rename 'garden' → 'garden_apartment'
        DB::table('properties')
            ->where('unit_style', 'garden')
            ->update(['unit_style' => 'garden_apartment']);

        // Convert 'standard' to null (will become empty array after JSON conversion)
        DB::table('properties')
            ->where('unit_style', 'standard')
            ->update(['unit_style' => null]);

        // Wrap all remaining non-null string values into JSON arrays
        DB::table('properties')
            ->whereNotNull('unit_style')
            ->where('unit_style', '!=', '')
            ->eachById(function ($property) {
                // Skip if already valid JSON array
                $decoded = json_decode($property->unit_style, true);
                if (is_array($decoded)) {
                    return;
                }

                DB::table('properties')
                    ->where('id', $property->id)
                    ->update(['unit_style' => json_encode([$property->unit_style])]);
            }, 100);

        // 3. Alter column type from string to JSON/text
        Schema::table('properties', function (Blueprint $table) {
            $table->json('unit_style')->nullable()->change();
        });

        // 4. Update property_sub_types lookup table: rename garden → garden_apartment, remove standard
        DB::table('property_sub_types')
            ->where('name', 'garden')
            ->update([
                'name'  => 'garden_apartment',
                'label' => 'Garden Apartment',
                'updated_at' => now(),
            ]);

        DB::table('property_sub_types')
            ->where('name', 'standard')
            ->delete();
    }

    public function down(): void
    {
        // 1. Revert lookup table changes
        DB::table('property_sub_types')
            ->where('name', 'garden_apartment')
            ->update([
                'name'  => 'garden',
                'label' => 'Garden',
                'updated_at' => now(),
            ]);

        // Re-insert 'standard' for each company
        $companies = DB::table('companies')->pluck('id');
        foreach ($companies as $companyId) {
            DB::table('property_sub_types')->insertOrIgnore([
                'company_id'  => $companyId,
                'name'        => 'standard',
                'label'       => 'Standard',
                'description' => null,
                'created_at'  => now(),
                'updated_at'  => now(),
            ]);
        }

        // 2. Convert JSON arrays back to single strings (take first element)
        DB::table('properties')
            ->whereNotNull('unit_style')
            ->where('unit_style', '!=', '')
            ->eachById(function ($property) {
                $decoded = json_decode($property->unit_style, true);
                $single = is_array($decoded) ? ($decoded[0] ?? null) : $property->unit_style;

                // Revert garden_apartment → garden
                if ($single === 'garden_apartment') {
                    $single = 'garden';
                }

                DB::table('properties')
                    ->where('id', $property->id)
                    ->update(['unit_style' => $single]);
            }, 100);

        // 3. Alter column back to string
        Schema::table('properties', function (Blueprint $table) {
            $table->string('unit_style')->nullable()->change();
        });

        // 4. Re-add the index
        Schema::table('properties', function (Blueprint $table) {
            $table->index('unit_style');
        });
    }
};
