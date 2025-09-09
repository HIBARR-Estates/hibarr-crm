<?php

namespace Modules\QRCode\Database\Seeders;

use App\Models\Company;
use Illuminate\Database\Seeder;
use Modules\QRCode\Entities\QrCodeData;

class QRCodeDatabaseSeeder extends Seeder
{

    public function run()
    {

        config(['app.seeding' => true]);

        if (!app()->environment('codecanyon')) {

            $companies = Company::select('id')->get();

            foreach ($companies as $company) {
                QrCodeData::factory()->data()->count(20)->create([
                    'company_id' => $company->id
                ]);
            }
        }

        config(['app.seeding' => false]);

    }

}
