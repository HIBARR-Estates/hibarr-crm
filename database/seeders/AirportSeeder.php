<?php

namespace Database\Seeders;

use App\Models\Airport;
use Illuminate\Database\Seeder;

class AirportSeeder extends Seeder
{
    /**
     * Run the database seeds.
     * 
     * Seeds default airport placeholder items.
     * These are global entries not tied to any company.
     */
    public function run(): void
    {
    $items = Airport::getDefaultItems();

        foreach ($items as $item) {
            Airport::firstOrCreate(
                ['name' => $item['name']],
                ['code' => $item['code']]
            );
        }
    }
}
