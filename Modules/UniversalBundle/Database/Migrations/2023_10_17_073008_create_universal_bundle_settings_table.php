<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Modules\UniversalBundle\Entities\UniversalBundleSetting;

return new class extends Migration {

    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        \App\Models\Module::validateVersion(UniversalBundleSetting::MODULE_NAME);

        if (!Schema::hasTable('universal_bundle_settings')) {
            Schema::create('universal_bundle_settings', function (Blueprint $table) {
                $table->id();
                $table->string('purchase_code')->nullable();
                $table->timestamp('supported_until')->nullable();
                $table->timestamps();
            });

            UniversalBundleSetting::create([]);
        }

        if (!Schema::hasTable('universal_module_installs')) {
            Schema::create('universal_module_installs', function (Blueprint $table) {
                $table->id();
                $table->string('module_name');
                $table->string('version')->nullable();
                $table->timestamps();
            });
        }

    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('universal_bundle_settings');
        Schema::dropIfExists('universal_module_installs');
    }

};
