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
                'value' => 0,
                'company_id' => 1,
                'description' => 'Banking and financial services package',
                'customer_type_name' => 'Banking Customer',
                'customer_type_description' => 'Customers requiring banking and financial services',
            ],
            [
                'name' => 'Inspection',
                'value' => 0,
                'company_id' => 1,
                'description' => 'Property inspection and assessment package',
                'customer_type_name' => 'Inspection Customer',
                'customer_type_description' => 'Customers requiring property inspection services',
            ],
        ];

        foreach ($packages as $packageData) {
            Package::create($packageData);
        }
    }
}
