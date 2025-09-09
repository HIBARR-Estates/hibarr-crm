<?php

use App\Models\Company;
use App\Models\Module;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Modules\Performance\Entities\PerformanceSetting;

return new class extends Migration
{

    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (!Schema::hasTable('performance_settings')) {
            Schema::create('performance_settings', function (Blueprint $table) {
                $table->id();
                $table->integer('company_id')->unsigned()->nullable();
                $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade')->onUpdate('cascade');
                $table->enum('send_notification', ['yes', 'no'])->default('no');
                $table->timestamps();
            });
        }

        Module::firstOrCreate(['module_name' => PerformanceSetting::MODULE_NAME]);

        $companies = Company::withoutGlobalScopes()->select('id')->get();

        foreach ($companies as $company) {
            PerformanceSetting::firstOrCreate([
                'company_id' => $company->id,
            ]);

            PerformanceSetting::addModuleSetting($company);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('performance_settings');
    }
};
