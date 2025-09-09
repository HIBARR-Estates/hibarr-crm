<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Modules\Performance\Entities\PerformanceGlobalSetting;

return new class extends Migration
{

    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (!Schema::hasTable('performance_global_settings')) {
            Schema::create('performance_global_settings', function (Blueprint $table) {
                $table->id();
                $table->string('purchase_code')->nullable();
                $table->string('license_type', 20)->nullable();
                $table->timestamp('purchased_on')->nullable();
                $table->timestamp('supported_until')->nullable();
                $table->boolean('notify_update')->default(1);
                $table->timestamps();
            });

            PerformanceGlobalSetting::create([]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('performance_global_settings');
    }

};
