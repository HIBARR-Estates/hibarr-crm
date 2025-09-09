<?php

namespace Modules\Payroll\Database\Seeders;

use Illuminate\Database\Seeder;

class PayrollDatabaseSeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * @return void
     */
    public function run()
    {
        config(['app.seeding' => true]);

        $this->call(PayrollCurrencySeederTableSeeder::class);

        config(['app.seeding' => false]);

    }
}
