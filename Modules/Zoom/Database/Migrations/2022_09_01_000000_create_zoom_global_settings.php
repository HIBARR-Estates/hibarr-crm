<?php

use App\Models\Module;
use App\Models\ModuleSetting;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Modules\Zoom\Entities\ZoomGlobalSetting;
use Modules\Zoom\Entities\ZoomSetting;

return new class extends Migration
{
    public function up()
    {
        Schema::create('zoom_global_settings', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('purchase_code')->nullable();
            $table->string('license_type', 20)->nullable();
            $table->timestamp('supported_until')->nullable();
            $table->timestamps();
        });

        $setting = ZoomSetting::withoutGlobalScope(\App\Scopes\CompanyScope::class)->first();

        $newZoomSetting = new ZoomGlobalSetting;

        if ($setting) {
            $newZoomSetting->purchase_code = $setting->purchase_code;
            $newZoomSetting->supported_until = $setting->supported_until;
            $newZoomSetting->saveQuietly();
        }

        $newZoomSetting->saveQuietly();

        Schema::table('zoom_setting', function (Blueprint $table) {
            $table->dropColumn(['purchase_code', 'supported_until']);
        });

        Module::where('module_name', 'Zoom')->update([
            'module_name' => ZoomSetting::MODULE_NAME,
        ]);

        ModuleSetting::where('module_name', 'Zoom')->update([
            'module_name' => ZoomSetting::MODULE_NAME,
        ]);
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::table('zoom_setting', function (Blueprint $table) {
            $table->dropColumn(['purchase_code', 'supported_until']);
        });
    }
};
