<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Updates residential property types per PRD:
 * - Adds "Semi-Detached Villa" and "Ruin" as new property types
 * - Reassigns residential category to only: Apartment, Villa, Semi-Detached Villa,
 *   Bungalow, Townhouse, Complete Building, Ruin
 * - Clears category from old residential types that are no longer residential
 *   (Family Home, Loft, Penthouse, Block of apartments, Residence, Half Construction,
 *   Time Share, Twin Villa, Abandoned Building)
 */
return new class extends Migration
{
    public function up(): void
    {
        $companies = DB::table('companies')->pluck('id');

        foreach ($companies as $companyId) {
            // 1. Insert new property types if they don't exist
            foreach (['Semi-Detached Villa', 'Ruin'] as $typeName) {
                DB::table('property_types')->updateOrInsert(
                    ['company_id' => $companyId, 'name' => $typeName],
                    [
                        'label'       => $typeName,
                        'category'    => 'residential',
                        'description' => null,
                        'created_at'  => now(),
                        'updated_at'  => now(),
                    ]
                );
            }

            // 2. Set category = 'residential' for the 7 PRD types
            DB::table('property_types')
                ->where('company_id', $companyId)
                ->whereIn('name', [
                    'Apartment', 'Villa', 'Semi-Detached Villa',
                    'Bungalow', 'Townhouse', 'Complete Building', 'Ruin',
                ])
                ->update(['category' => 'residential']);

            // 3. Clear residential category from types that shouldn't be residential anymore
            DB::table('property_types')
                ->where('company_id', $companyId)
                ->where('category', 'residential')
                ->whereNotIn('name', [
                    'Apartment', 'Villa', 'Semi-Detached Villa',
                    'Bungalow', 'Townhouse', 'Complete Building', 'Ruin',
                ])
                ->update(['category' => null]);
        }
    }

    public function down(): void
    {
        $companies = DB::table('companies')->pluck('id');

        foreach ($companies as $companyId) {
            // Restore old residential category assignments
            DB::table('property_types')
                ->where('company_id', $companyId)
                ->whereIn('name', [
                    'Villa', 'Twin Villa', 'Apartment', 'Family Home', 'Townhouse',
                    'Loft', 'Penthouse', 'Bungalow', 'Block of apartments',
                    'Complete Building', 'Abandoned Building', 'Residence',
                    'Half Construction', 'Time Share',
                ])
                ->update(['category' => 'residential']);

            // Clear category from the new types
            DB::table('property_types')
                ->where('company_id', $companyId)
                ->whereIn('name', ['Semi-Detached Villa', 'Ruin'])
                ->update(['category' => null]);
        }
    }
};
