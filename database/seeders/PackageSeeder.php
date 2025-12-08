<?php

namespace Database\Seeders;

use App\Models\Package;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class PackageSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $packages = [
            [
                'name' => 'Basic',
                'value' => 0,
                'company_id' => 1,
                'description' => 'Basic package with essential features',
                'customer_type_name' => 'Standard Customer',
                'customer_type_description' => 'Regular customers with basic needs',
            ],
            [
                'name' => 'Bank',
                'value' => 1400,
                'company_id' => 1,
                'description' => 'Banking and financial services package',
                'customer_type_name' => 'Banking Customer',
                'customer_type_description' => 'Customers requiring banking and financial services',
            ],
            [
                'name' => 'Inspection',
                'value' => 5000,
                'company_id' => 1,
                'description' => 'Property inspection and assessment package',
                'customer_type_name' => 'Inspection Customer',
                'customer_type_description' => 'Customers requiring property inspection services',
            ],
            [
                'name' => 'Asset Protection',
                'value' => 6500,
                'company_id' => 1,
                'description' => 'Comprehensive asset protection package',
                'customer_type_name' => 'Asset Protection Customer',
                'customer_type_description' => 'Customers requiring asset protection services',
            ],
            [
                'name' => 'Legal Service',
                'value' => 2700,
                'company_id' => 1,
                'description' => 'Legal services and consultation package',
                'customer_type_name' => 'Legal Service Customer',
                'customer_type_description' => 'Customers requiring legal services',
            ],
        ];

        foreach ($packages as $packageData) {
            Package::updateOrCreate(
                [
                    'name' => $packageData['name'],
                    'company_id' => $packageData['company_id'],
                ],
                $packageData
            );
        }
    }
}
