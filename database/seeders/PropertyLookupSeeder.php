<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use App\Models\Company;

/**
 * Seeds all 9 property lookup tables with default values derived from
 * the hardcoded constants in App\Models\Property.
 *
 * Idempotent: uses firstOrCreate keyed by (company_id, name).
 * Runs for every company in the system.
 */
class PropertyLookupSeeder extends Seeder
{
    public function run(): void
    {
        $companies = Company::all();

        if ($companies->isEmpty()) {
            $this->command?->warn('No companies found — skipping PropertyLookupSeeder.');
            return;
        }

        foreach ($companies as $company) {
            $this->seedForCompany($company->id);
        }

        $this->command?->info('PropertyLookupSeeder completed for ' . $companies->count() . ' company(ies).');
    }

    private function seedForCompany(int $companyId): void
    {
        $this->seedPropertyTypes($companyId);
        $this->seedPropertySubTypes($companyId);
        $this->seedPropertyPrimaryCategories($companyId);
        $this->seedPropertyViewTypes($companyId);
        $this->seedPropertyTitleDeedTypes($companyId);
        $this->seedPropertyExteriorFeatures($companyId);
        $this->seedPropertyInteriorFeatures($companyId);
        $this->seedPropertyFloorTypes($companyId);
        $this->seedPropertyDeedStatuses($companyId);
    }

    // -----------------------------------------------------------------
    // 1. Property Types
    // -----------------------------------------------------------------
    private function seedPropertyTypes(int $companyId): void
    {
        $types = [
            'Villa',
            'Twin Villa',
            'Apartment',
            'Family Home',
            'Townhouse',
            'Loft',
            'Penthouse',
            'Bungalow',
            'Commercial Property',
            'Block of apartments',
            'Complete Building',
            'Abandoned Building',
            'Residence',
            'Half Construction',
            'Time Share',
            'Residentially Zoned Land',
            'Field',
            'Residentially and Commercially Zoned Land',
            'Commercially Zoned Land',
            'Industrially Zoned land',
            'Tourism Zoned Land',
            'Olive Grove',
            'Shop',
            'Hotel',
            'Workplace',
            'Warehouse',
            'Workplace for sale',
            'Office',
        ];

        $this->insertLookup('property_types', $companyId, $types);
    }

    // -----------------------------------------------------------------
    // 2. Property Sub Types / Unit Styles
    // -----------------------------------------------------------------
    private function seedPropertySubTypes(int $companyId): void
    {
        $subTypes = [
            'standard',
            'penthouse',
            'loft',
            'garden',
            'duplex',
            'triplex',
            'studio',
        ];

        $this->insertLookup('property_sub_types', $companyId, $subTypes);
    }

    // -----------------------------------------------------------------
    // 3. Property Primary Categories
    // -----------------------------------------------------------------
    private function seedPropertyPrimaryCategories(int $companyId): void
    {
        $categories = [
            'residential',
            'commercial',
            'land',
        ];

        $this->insertLookup('property_primary_categories', $companyId, $categories);
    }

    // -----------------------------------------------------------------
    // 4. Property View Types
    // -----------------------------------------------------------------
    private function seedPropertyViewTypes(int $companyId): void
    {
        $viewTypes = [
            'sea_front',
            'sea_view',
            'mountain_view',
            'pool_view',
            'garden_view',
            'city_view',
        ];

        $this->insertLookup('property_view_types', $companyId, $viewTypes);
    }

    // -----------------------------------------------------------------
    // 5. Property Title Deed Types
    // -----------------------------------------------------------------
    private function seedPropertyTitleDeedTypes(int $companyId): void
    {
        $deedTypes = [
            ['name' => 'turkish_british',   'label' => 'Turkish/British'],
            ['name' => 'exchange',           'label' => 'Exchange (Eşdeğer)'],
            ['name' => 'trnc_allocation',    'label' => 'TRNC Allocation (Tahsis/TMD)'],
            ['name' => 'leasehold',          'label' => 'Leasehold (Vakıf/Ministry)'],
            ['name' => 'mujahit',            'label' => 'Mücahit'],
        ];

        foreach ($deedTypes as $dt) {
            DB::table('property_title_deed_types')->updateOrInsert(
                ['company_id' => $companyId, 'name' => $dt['name']],
                [
                    'label' => $dt['label'],
                    'description' => null,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]
            );
        }
    }

    // -----------------------------------------------------------------
    // 6. Property Exterior Features
    // -----------------------------------------------------------------
    private function seedPropertyExteriorFeatures(int $companyId): void
    {
        $features = [
            'barbeque',
            'bounding_wall',
            'double_glazing',
            'car_park_closed',
            'garage',
            'garden',
            'generator',
            'lift',
            'car_park_open',
            'private_pool',
            'public_pool',
            'sari_tas_ev',
            'security_cam',
            'water_well',
            'terrace',
            'thermal_insulation',
            'water_tank',
        ];

        $this->insertLookup('property_exterior_features', $companyId, $features);
    }

    // -----------------------------------------------------------------
    // 7. Property Interior Features
    // -----------------------------------------------------------------
    private function seedPropertyInteriorFeatures(int $companyId): void
    {
        $features = [
            'air_condition',
            'balcony',
            'bath_tube',
            'blind',
            'built_in_kitchen',
            'ceramic',
            'closet',
            'entryphone',
            'fire_alarm',
            'fireplace',
            'kartonpiyer',
            'laundry',
            'master_room_bath',
            'master_room_cabinet',
            'natural_marble',
            'panel_door',
            'pantry',
            'parquet',
            'shower',
            'solar_electric',
            'steel_door',
            'tv_infrastructure',
            'coat_check',
            'wallpaper',
            'water_booster',
        ];

        $this->insertLookup('property_interior_features', $companyId, $features);
    }

    // -----------------------------------------------------------------
    // 8. Property Floor Types
    // -----------------------------------------------------------------
    private function seedPropertyFloorTypes(int $companyId): void
    {
        $floors = [
            ['name' => 'basement_-1', 'label' => 'Basement -1'],
            ['name' => 'ground_floor', 'label' => 'Ground Floor'],
        ];

        // Floors 1 through 15+
        for ($i = 1; $i <= 15; $i++) {
            $floors[] = ['name' => 'floor_' . $i, 'label' => 'Floor ' . $i];
        }
        $floors[] = ['name' => 'floor_15_plus', 'label' => '15+'];

        foreach ($floors as $f) {
            DB::table('property_floor_types')->updateOrInsert(
                ['company_id' => $companyId, 'name' => $f['name']],
                [
                    'label' => $f['label'],
                    'description' => null,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]
            );
        }
    }

    // -----------------------------------------------------------------
    // 9. Property Deed Statuses
    // -----------------------------------------------------------------
    private function seedPropertyDeedStatuses(int $companyId): void
    {
        $statuses = [
            ['name' => 'owner_individual',  'label' => "Deed in Owner's Name (Individual)"],
            ['name' => 'owner_shared',      'label' => "Deed in Owner's Name (Shared)"],
            ['name' => 'developer_ready',   'label' => "Deed in Developer's Name (Ready)"],
            ['name' => 'no_deed',           'label' => 'No Deed (Sales Agreement Only)'],
        ];

        foreach ($statuses as $s) {
            DB::table('property_deed_statuses')->updateOrInsert(
                ['company_id' => $companyId, 'name' => $s['name']],
                [
                    'label' => $s['label'],
                    'description' => null,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]
            );
        }
    }

    // -----------------------------------------------------------------
    // Helper: insert simple name-based lookup rows
    // -----------------------------------------------------------------
    private function insertLookup(string $table, int $companyId, array $names): void
    {
        foreach ($names as $name) {
            DB::table($table)->updateOrInsert(
                ['company_id' => $companyId, 'name' => $name],
                [
                    'label' => $this->nameToLabel($name),
                    'description' => null,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]
            );
        }
    }

    /**
     * Convert a snake_case or slug-style name to a Title Case label.
     * e.g. "sea_front" → "Sea Front", "barbeque" → "Barbeque"
     * If the name is already human-readable (contains spaces, mixed case),
     * return it as-is.
     */
    private function nameToLabel(string $name): string
    {
        // If the name already contains spaces, it's likely already a label
        if (str_contains($name, ' ')) {
            return $name;
        }

        return Str::of($name)->replace('_', ' ')->title()->toString();
    }
}
