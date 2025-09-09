<?php

use App\Models\Company;
use App\Models\ModuleSetting;
use Illuminate\Database\Migrations\Migration;
use Modules\RestAPI\Entities\RestAPISetting;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * @return array
     */
    public function up()
    {

        \App\Models\Module::validateVersion(RestAPISetting::MODULE_NAME);

        \App\Models\Module::where('module_name', 'restApi')->update([
            'module_name' => RestAPISetting::MODULE_NAME,
        ]);

        ModuleSetting::where('module_name', 'restApi')->update([
            'module_name' => RestAPISetting::MODULE_NAME,
        ]);

        // Rename restApi to restapi
        \App\Models\Module::firstOrCreate(['module_name' => 'restapi']);

        $companies = Company::all();

        // We will insert these for the new company from event listener also
        foreach ($companies as $company) {
            RestAPISetting::addModuleSetting($company);
        }
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        //
    }
};
