<?php

use App\Models\Company;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {

        $companies = Company::all();

        // We will insert these for the new company from event listener
        foreach ($companies as $company) {
            \Modules\Zoom\Entities\ZoomSetting::addModuleSetting($company);
        }
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('zoom_notification_settings');
    }
};
