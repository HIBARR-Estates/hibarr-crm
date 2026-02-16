<?php

namespace Database\Seeders;

use App\Models\Developer;
use Illuminate\Database\Seeder;

/**
 * Seeds construction companies (Developers) with their project lists.
 * 
 * Uses updateOrCreate by name to be idempotent — safe to run multiple times.
 * The project_list JSON field stores an array of project name strings
 * that populate the project dropdown when a developer is selected.
 */
class ConstructionCompanySeeder extends Seeder
{
    /**
     * Construction companies and their associated project names.
     */
    private const COMPANIES = [
        'AKACAN' => [
            'The Mall & Residence',
            'Cruise',
            'Premium',
        ],
        'ARDEM' => [
            'Vista Life',
            'Karmi Valley Homes',
        ],
        'CAPITON' => [
            'Villa Bella',
            'La Plage',
            'Ozankoy Villas',
            'Sunset Bay',
            'Capiton Karaoglanoglu',
            'CC- Tower Girne',
            'CC- Tower Iskele',
            'The Nest',
        ],
        'CARRINGTON' => [
            'Pine Hill Residence',
            'Poseidon',
            'Atlantis',
            'Malibu',
            'Malibu Phase 5',
            'Malibu Zone 6',
            'Carrington 22',
            'Elite Residence',
            'Sea Magic Deluxe',
            'Park Avenue Kyrenia',
            'Lagoon',
            'The Residence',
            'Sea Magic Park',
            'Sea Magic Premium',
            'Sea Magic Garden',
            'Sea Magic Royal',
            'Sea Magic Villas',
            'Carrington 55',
        ],
        'CYPRUS CONSTRUCTION' => [
            'Phuket Health and Wellness resort',
            'Aloha Beach Resort',
            'Hawaii Homes',
            'Bahamas Homes',
            'Mykonos Homes',
            'Pearl Island Homes',
            'Idyll Homes',
            'Edremit Villas',
            'Maldives Homes',
        ],
        'DOVEC' => [
            'Courtyard Platinum',
            'Natulux',
            'La Casalia',
            'Querencia Long Beach',
            'La Isla Villas',
            'Panorama Long Beach',
        ],
        'EMTAN' => [
            'Olive Hill 5',
            'Reflection',
            'Spectra',
        ],
        'EDEN' => [
            'Eden Corners',
        ],
        'KAYM' => [
            'Aelita Garden Resort',
            'Albatros View',
            'Golf Resort',
            'Golf Resort Phase 3',
            'Olive Trees Villas',
            'Skyland Esentepe',
            'Sunny Hill',
        ],
        'KENSINGTON' => [
            'K- Islands',
            'Thalassa Beach Resort',
            'Karpasia Elite',
            'Villas',
        ],
        'KOFALI' => [
            'Sunland',
            'Palmera',
            'Delonix',
            'Jacaranda',
            'Tecoma Gold',
        ],
        'NOYANLAR' => [
            'Royal Life',
            'Park Residence',
            'Royal Sun Elite Residence',
            'Ocean Life',
            'Sea Breeze',
            'Riverside Blue',
            'Riverside Life',
            'La Palazzo',
            'Blu Residence',
            'Olea Residence',
        ],
        'NORTHERNLAND' => [
            'Catalkoy Villas',
            'Esentepe Luxury Villas',
            'Casa Del Mare',
            'Grand Sapphire',
            'Grand Sapphire BLU',
            'Grand Sapphire F',
        ],
        'NUREL' => [
            'Floral Homes',
        ],
        'PANAH' => [
            'Aventus Residence',
            'Magnolia Residence',
            'Sparda Villas',
        ],
        'SIFA' => [
            'Lanai Homes',
            'Capensis Homes',
            'Tilia Luxury villas',
        ],
    ];

    public function run(): void
    {
        // We need a company_id — use the first company or a default
        $companyId = \App\Models\Company::first()?->id ?? 1;

        foreach (self::COMPANIES as $companyName => $projects) {
            Developer::updateOrCreate(
                [
                    'name' => $companyName,
                    'company_id' => $companyId,
                ],
                [
                    'project_list' => $projects,
                    'description' => "{$companyName} Construction Company",
                ]
            );
        }

        $this->command->info('Seeded ' . count(self::COMPANIES) . ' construction companies with project lists.');
    }
}
