<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Adds a configurable maximum concurrent calls limit to phone lines (softphone devices).
 * Defaults to 2 (standard Sipgate limit).
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('softphone_devices') || Schema::hasColumn('softphone_devices', 'max_concurrent_calls')) {
            return;
        }

        Schema::table('softphone_devices', function (Blueprint $table) {
            $table->unsignedInteger('max_concurrent_calls')->default(2)->after('is_active');
        });
    }

    public function down(): void
    {
        if (Schema::hasTable('softphone_devices') && Schema::hasColumn('softphone_devices', 'max_concurrent_calls')) {
            Schema::table('softphone_devices', function (Blueprint $table) {
                $table->dropColumn('max_concurrent_calls');
            });
        }
    }
};
