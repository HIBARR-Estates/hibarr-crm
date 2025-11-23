<?php

namespace Database\Seeders;

use App\Models\DealPropertyService;
use Illuminate\Database\Seeder;

class DealPropertyServiceSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $services = [
            [
                'name' => 'Asset Protection',
                'category' => 'Legal Service',
                'value' => 6.500,
                'description' => 'Comprehensive asset protection service.',
            ],
            [
                'name' => 'Secure Bank Account',
                'category' => 'Financial Service',
                'value' => 1.400,
                'description' => 'Service for forming a new company.',
            ],
            [
                'name' => 'Legal Service',
                'category' => 'Legal Service',
                'value' => 2.700,
                'description' => 'Consultation for tax planning and compliance.',
            ],
           
             [
                'name' => 'Real Estate & Inspection',
                'category' => 'Real Estate',
                'value' => 5.000,
                'description' => 'Management of real estate properties.',
            ],
        ];

        foreach ($services as $service) {
            DealPropertyService::create($service);
        }
    }
}
