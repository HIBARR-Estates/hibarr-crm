<?php

namespace Database\Seeders;

use App\Models\Infrastructure;
use Illuminate\Database\Seeder;

class InfrastructureSeeder extends Seeder
{
    /**
     * Run the database seeds.
     * 
     * Seeds default infrastructure items that are available globally (company_id = null).
     * These can be used by any company, and companies can also add their own custom items.
     */
    public function run(): void
    {
        $items = Infrastructure::getDefaultItems();

        foreach ($items as $item) {
            Infrastructure::firstOrCreate(
                ['name' => $item['name'], 'company_id' => null],
                ['icon' => $item['icon']]
            );
        }
    }
}
