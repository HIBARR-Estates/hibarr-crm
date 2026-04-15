<?php

namespace Database\Seeders;

use App\Models\Company;
use App\Models\ProjectFacility;
use Illuminate\Database\Seeder;

/**
 * Seed the project_facilities table with the 37 default facilities
 * that were previously hardcoded in DeveloperProject::FACILITIES.
 *
 * Seeds for every existing company. Skips duplicates (by company_id + name).
 */
class ProjectFacilitySeeder extends Seeder
{
    /**
     * Default facilities with label and icon mapping.
     * Icon values correspond to Lucide icon identifiers.
     */
    private const DEFAULTS = [
        ['name' => 'gym',                  'label' => 'Gym',                  'icon' => 'dumbbell'],
        ['name' => 'hamam',                'label' => 'Hamam',                'icon' => 'sparkles'],
        ['name' => 'sauna',                'label' => 'Sauna',                'icon' => 'sparkles'],
        ['name' => 'massage_spa',          'label' => 'Massage and Spa',      'icon' => 'sparkles'],
        ['name' => 'indoor_pool',          'label' => 'Indoor Pool',          'icon' => 'waves'],
        ['name' => 'outdoor_pool',         'label' => 'Outdoor Pool',         'icon' => 'waves'],
        ['name' => 'heated_indoor_pool',   'label' => 'Heated Indoor Pool',   'icon' => 'waves'],
        ['name' => 'kids_playground',      'label' => 'Kids Playground',      'icon' => 'baby'],
        ['name' => 'aquapark',             'label' => 'Aquapark',             'icon' => 'waves'],
        ['name' => 'mini_zoo',             'label' => 'Mini Zoo',             'icon' => 'tree-pine'],
        ['name' => 'clinics',              'label' => 'Clinics',              'icon' => 'heart-pulse'],
        ['name' => 'restaurant',           'label' => 'Restaurant',           'icon' => 'utensils-crossed'],
        ['name' => 'beauty_center',        'label' => 'Beauty Center',        'icon' => 'sparkles'],
        ['name' => 'walking_paths',        'label' => 'Walking Paths',        'icon' => 'bike'],
        ['name' => 'cycling_routes',       'label' => 'Cycling Routes',       'icon' => 'bike'],
        ['name' => 'hiking_routes',        'label' => 'Hiking Routes',        'icon' => 'bike'],
        ['name' => 'dentist',              'label' => 'Dentist',              'icon' => 'heart-pulse'],
        ['name' => 'healing_yoga',         'label' => 'Healing/Yoga',         'icon' => 'wind'],
        ['name' => 'tennis_court',         'label' => 'Tennis Court',         'icon' => 'trophy'],
        ['name' => 'basketball_court',     'label' => 'Basketball Court',     'icon' => 'trophy'],
        ['name' => 'reception',            'label' => 'Reception',            'icon' => 'building-2'],
        ['name' => 'security_24_7',        'label' => '24/7 Security',        'icon' => 'shield-check'],
        ['name' => 'beach',                'label' => 'Beach',                'icon' => 'sailboat'],
        ['name' => 'beach_cinema',         'label' => 'Beach Cinema',         'icon' => 'clapperboard'],
        ['name' => 'cinema',               'label' => 'Cinema',               'icon' => 'clapperboard'],
        ['name' => 'casino',               'label' => 'Casino',               'icon' => 'building-2'],
        ['name' => 'jacuzzi',              'label' => 'Jacuzzi',              'icon' => 'waves'],
        ['name' => 'gated_community',      'label' => 'Gated Community',      'icon' => 'shield-check'],
        ['name' => 'football_court',       'label' => 'Football Court',       'icon' => 'trophy'],
        ['name' => 'volleyball_court',     'label' => 'Volleyball Court',     'icon' => 'trophy'],
        ['name' => 'supermarket',          'label' => 'Supermarket',          'icon' => 'shopping-cart'],
        ['name' => 'cafe',                 'label' => 'Cafe',                 'icon' => 'utensils-crossed'],
        ['name' => 'bar',                  'label' => 'Bar',                  'icon' => 'utensils-crossed'],
        ['name' => 'car_park',             'label' => 'Car Park',             'icon' => 'parking-square'],
        ['name' => 'cleaning_service',     'label' => 'Cleaning Service',     'icon' => 'building-2'],
        ['name' => 'central_generator',    'label' => 'Central Generator',    'icon' => 'building-2'],
        ['name' => 'on_site_management',   'label' => 'On-site Management',   'icon' => 'briefcase-business'],
    ];

    public function run(): void
    {
        $companies = Company::pluck('id');

        foreach ($companies as $companyId) {
            foreach (self::DEFAULTS as $facility) {
                ProjectFacility::firstOrCreate(
                    [
                        'company_id' => $companyId,
                        'name'       => $facility['name'],
                    ],
                    [
                        'label'       => $facility['label'],
                        'icon'        => $facility['icon'],
                    ]
                );
            }
        }
    }
}
