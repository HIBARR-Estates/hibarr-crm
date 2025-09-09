<?php

use App\Models\Module;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Modules\CyberSecurity\Entities\CyberSecuritySetting;

return new class extends Migration
{

    /**
     * Run the migrations.
     */
    public function up(): void
    {
        \App\Models\Module::validateVersion(CyberSecuritySetting::MODULE_NAME);

        if (!Schema::hasTable('cyber_security_settings')) {
            Schema::create('cyber_security_settings', function (Blueprint $table) {
                $table->id();
                $table->string('purchase_code')->nullable();
                $table->timestamp('supported_until')->nullable();
                $table->timestamp('purchased_on')->nullable();
                $table->boolean('notify_update')->default(1);
                $table->string('license_type', 20)->nullable();
                $table->timestamps();
            });

            CyberSecuritySetting::create([]);
        }

    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('cyber_security_settings');
    }

};
