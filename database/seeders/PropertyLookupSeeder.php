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

        // New lookup tables
        $this->seedConstructionStatuses($companyId);
        $this->seedOccupancyTypes($companyId);
        $this->seedFurnitureStatuses($companyId);
        $this->seedHeatingTypes($companyId);
        $this->seedCities($companyId);
        $this->seedSaleTypes($companyId);
        $this->seedStatuses($companyId);
        $this->seedLocationFeatures($companyId);
        $this->seedAddOns($companyId);

        // Assign categories to property types
        $this->assignPropertyTypeCategories($companyId);
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

    // -----------------------------------------------------------------
    // 10. Construction Statuses
    // -----------------------------------------------------------------
    private function seedConstructionStatuses(int $companyId): void
    {
        $items = [
            ['name' => 'off_plan',            'label' => 'Off-Plan'],
            ['name' => 'under_construction',   'label' => 'Under Construction'],
            ['name' => 'completed_new',        'label' => 'Completed (New)'],
            ['name' => 'resale',               'label' => 'Resale'],
            ['name' => 'ruin_renovation',      'label' => 'Ruin (For Renovation)'],
        ];

        $this->insertLookupWithLabels('property_construction_statuses', $companyId, $items);
    }

    // -----------------------------------------------------------------
    // 11. Occupancy Types
    // -----------------------------------------------------------------
    private function seedOccupancyTypes(int $companyId): void
    {
        $items = [
            ['name' => 'owner_occupied', 'label' => 'Owner Occupied'],
            ['name' => 'tenant',         'label' => 'Tenant'],
            ['name' => 'vacant',         'label' => 'Vacant'],
        ];

        $this->insertLookupWithLabels('property_occupancy_types', $companyId, $items);
    }

    // -----------------------------------------------------------------
    // 12. Furniture Statuses
    // -----------------------------------------------------------------
    private function seedFurnitureStatuses(int $companyId): void
    {
        // Names match values stored in properties.furniture_status (Title Case)
        $items = [
            ['name' => 'Unfurnished',      'label' => 'Unfurnished'],
            ['name' => 'Fully Furnished',  'label' => 'Fully Furnished'],
            ['name' => 'Furnished',        'label' => 'Furnished'],
            ['name' => 'Semi-Furnished',   'label' => 'Semi-Furnished'],
            ['name' => 'Part Furnished',   'label' => 'Part Furnished'],
            ['name' => 'White Goods Only', 'label' => 'White Goods Only'],
        ];

        $this->insertLookupWithLabels('property_furniture_statuses', $companyId, $items);
    }

    // -----------------------------------------------------------------
    // 13. Heating Types
    // -----------------------------------------------------------------
    private function seedHeatingTypes(int $companyId): void
    {
        $items = [
            ['name' => 'central',    'label' => 'Central Heating'],
            ['name' => 'underfloor', 'label' => 'Underfloor Heating'],
            ['name' => 'ac',         'label' => 'Air Conditioning'],
            ['name' => 'stove',      'label' => 'Stove'],
            ['name' => 'solar',      'label' => 'Solar'],
            ['name' => 'none',       'label' => 'None'],
        ];

        $this->insertLookupWithLabels('property_heating_types', $companyId, $items);
    }

    // -----------------------------------------------------------------
    // 14. Cities
    // -----------------------------------------------------------------
    private function seedCities(int $companyId): void
    {
        $items = [
            ['name' => 'nicosia',   'label' => 'Nicosia (Lefkoşa)'],
            ['name' => 'kyrenia',   'label' => 'Kyrenia (Girne)'],
            ['name' => 'famagusta', 'label' => 'Famagusta (Gazimağusa)'],
            ['name' => 'guzelyurt', 'label' => 'Güzelyurt (Morphou)'],
            ['name' => 'iskele',    'label' => 'İskele (Trikomo)'],
            ['name' => 'lefke',     'label' => 'Lefke (Lefka)'],
        ];

        $this->insertLookupWithLabels('property_cities', $companyId, $items);
    }

    // -----------------------------------------------------------------
    // 15. Sale Types
    // -----------------------------------------------------------------
    private function seedSaleTypes(int $companyId): void
    {
        // Names match values stored in properties.sale_type (Title Case)
        $items = [
            ['name' => 'For Sale',         'label' => 'For Sale'],
            ['name' => 'For Rent',         'label' => 'For Rent'],
            ['name' => 'For Daily Rental', 'label' => 'For Daily Rental'],
        ];

        $this->insertLookupWithLabels('property_sale_types', $companyId, $items);
    }

    // -----------------------------------------------------------------
    // 16. Statuses
    // -----------------------------------------------------------------
    private function seedStatuses(int $companyId): void
    {
        // Names match values stored in properties.status (Title Case / mixed)
        $items = [
            ['name' => 'Available',   'label' => 'Available'],
            ['name' => 'Reserved',    'label' => 'Reserved'],
            ['name' => 'Under offer', 'label' => 'Under Offer'],
            ['name' => 'Sold',        'label' => 'Sold'],
            ['name' => 'Rented',      'label' => 'Rented'],
            ['name' => 'Withdrawn',   'label' => 'Withdrawn'],
        ];

        $this->insertLookupWithLabels('property_statuses', $companyId, $items);
    }

    // -----------------------------------------------------------------
    // 17. Location Features
    // -----------------------------------------------------------------
    private function seedLocationFeatures(int $companyId): void
    {
        $features = [
            'Near Beach', 'Near School', 'Near Hospital', 'Near Market',
            'Near Public Transport', 'Near Mosque', 'Near Restaurant',
            'Near Highway', 'Near Airport', 'City Center', 'Quiet Area',
            'Rural Area', 'Mountain Area', 'Coastal Area', 'Forest Area',
            'Nature View', 'Walking Distance to Beach', 'Near University',
            'Near Park', 'Near Marina', 'Near Golf Course', 'Near Casino',
            'Near Shopping Mall',
        ];

        $this->insertLookup('property_location_features', $companyId, $features);
    }

    // -----------------------------------------------------------------
    // 18. Add-Ons
    // -----------------------------------------------------------------
    private function seedAddOns(int $companyId): void
    {
        $addOns = [
            'Furniture Package', 'White Goods Package', 'Rental Management',
            'Maintenance Package', 'Insurance', 'Legal Support',
            'Title Deed Transfer Costs', 'VAT Included', 'Rental Guarantee',
            'Buy-Back Guarantee', 'Payment Plan Available',
            'Crypto Payment Accepted', 'Exchange Available',
            'Part Exchange Considered', 'Company Name Transfer',
            'Investment Package',
        ];

        $this->insertLookup('property_add_ons', $companyId, $addOns);
    }

    // -----------------------------------------------------------------
    // Assign category to existing property types
    // -----------------------------------------------------------------
    private function assignPropertyTypeCategories(int $companyId): void
    {
        $categoryMap = [
            'residential' => [
                'Villa', 'Twin Villa', 'Apartment', 'Family Home', 'Townhouse',
                'Loft', 'Penthouse', 'Bungalow', 'Block of apartments',
                'Complete Building', 'Abandoned Building', 'Residence',
                'Half Construction', 'Time Share',
            ],
            'commercial' => [
                'Shop', 'Hotel', 'Workplace', 'Warehouse', 'Workplace for sale',
                'Office', 'Commercial Property', 'Business',
            ],
            'land' => [
                'Residentially Zoned Land', 'Field',
                'Residentially and Commercially Zoned Land',
                'Commercially Zoned Land', 'Industrially Zoned land',
                'Tourism Zoned Land', 'Olive Grove',
            ],
        ];

        foreach ($categoryMap as $category => $types) {
            DB::table('property_types')
                ->where('company_id', $companyId)
                ->whereIn('name', $types)
                ->update(['category' => $category]);
        }
    }

    // -----------------------------------------------------------------
    // Helper: insert lookup rows with explicit name+label pairs
    // -----------------------------------------------------------------
    private function insertLookupWithLabels(string $table, int $companyId, array $items): void
    {
        foreach ($items as $item) {
            DB::table($table)->updateOrInsert(
                ['company_id' => $companyId, 'name' => $item['name']],
                [
                    'label' => $item['label'],
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
