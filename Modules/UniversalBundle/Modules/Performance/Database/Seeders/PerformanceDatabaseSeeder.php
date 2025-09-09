<?php

namespace Modules\Performance\Database\Seeders;

use App\Models\Company;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\App;

class PerformanceDatabaseSeeder extends Seeder
{

    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        config(['app.seeding' => true]);

        $companies = Company::all();

        foreach ($companies as $company) {

            if (!App::environment('codecanyon')) {
                $this->call(ObjectiveDataSeeder::class, false, ['companyId' => $company->id]);
                $this->call(MeetingDataSeeder::class, false, ['companyId' => $company->id]);
            }
        }

        config(['app.seeding' => false]);
    }
}
