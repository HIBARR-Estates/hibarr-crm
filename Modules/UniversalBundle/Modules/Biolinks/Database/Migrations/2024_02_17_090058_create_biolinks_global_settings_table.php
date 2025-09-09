<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Modules\Biolinks\Entities\BiolinksGlobalSetting;

return new class extends Migration {

    /**
     * Run the migrations.
     */
    public function up(): void
    {
        \App\Models\Module::validateVersion(BiolinksGlobalSetting::MODULE_NAME);

        if (!Schema::hasTable('biolinks_global_settings')) {
            Schema::create('biolinks_global_settings', function (Blueprint $table) {
                $table->id();
                $table->string('purchase_code')->nullable();
                $table->timestamp('supported_until')->nullable();
                $table->timestamp('purchased_on')->nullable();
                $table->boolean('notify_update')->default(1);
                $table->string('license_type', 20)->nullable();
                $table->timestamps();
            });

            BiolinksGlobalSetting::create([]);
        }

    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('biolinks_global_settings');
    }

};
