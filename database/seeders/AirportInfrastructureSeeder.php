<?php

namespace Database\Seeders;

use App\Models\Airport;
use App\Models\Company;
use App\Models\Infrastructure;
use Illuminate\Database\Seeder;

class AirportInfrastructureSeeder extends Seeder
{
    private const DEFAULT_AIRPORTS = [
        [
            'name' => 'ercan_international',
            'label' => 'Ercan International',
            'code' => 'ECN',
            'image_url' => 'https://placehold.co/1200x800/png?text=Ercan+International',
        ],
        [
            'name' => 'larnaca_international',
            'label' => 'Larnaca International',
            'code' => 'LCA',
            'image_url' => 'https://placehold.co/1200x800/png?text=Larnaca+International',
        ],
        [
            'name' => 'paphos_international',
            'label' => 'Paphos International',
            'code' => 'PFO',
            'image_url' => 'https://placehold.co/1200x800/png?text=Paphos+International',
        ],
    ];

    private const DEFAULT_INFRASTRUCTURES = [
        ['name' => 'hospital', 'label' => 'Hospital', 'icon' => 'heart-pulse', 'image_url' => 'https://placehold.co/1200x800/png?text=Hospital'],
        ['name' => 'school', 'label' => 'School', 'icon' => 'graduation-cap', 'image_url' => 'https://placehold.co/1200x800/png?text=School'],
        ['name' => 'shopping_mall', 'label' => 'Shopping Mall', 'icon' => 'shopping-cart', 'image_url' => 'https://placehold.co/1200x800/png?text=Shopping+Mall'],
        ['name' => 'supermarket', 'label' => 'Supermarket', 'icon' => 'store', 'image_url' => 'https://placehold.co/1200x800/png?text=Supermarket'],
        ['name' => 'beach', 'label' => 'Beach', 'icon' => 'waves', 'image_url' => 'https://placehold.co/1200x800/png?text=Beach'],
    ];

    public function run(): void
    {
        $companyIds = Company::pluck('id');

        foreach ($companyIds as $companyId) {
            foreach (self::DEFAULT_AIRPORTS as $airport) {
                Airport::updateOrCreate(
                    [
                        'company_id' => $companyId,
                        'name' => $airport['name'],
                    ],
                    [
                        'label' => $airport['label'],
                        'code' => $airport['code'],
                        'description' => null,
                        'image_url' => $airport['image_url'],
                    ],
                );
            }

            foreach (self::DEFAULT_INFRASTRUCTURES as $infrastructure) {
                Infrastructure::updateOrCreate(
                    [
                        'company_id' => $companyId,
                        'name' => $infrastructure['name'],
                    ],
                    [
                        'label' => $infrastructure['label'],
                        'icon' => $infrastructure['icon'],
                        'description' => null,
                        'image_url' => $infrastructure['image_url'],
                    ],
                );
            }
        }
    }
}
