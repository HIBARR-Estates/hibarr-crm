<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A line can be disabled: it then gets no credentials, so no browser can
 * register it, and it neither places nor receives calls. Existing lines stay on.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('softphone_devices') || Schema::hasColumn('softphone_devices', 'is_active')) {
            return;
        }

        Schema::table('softphone_devices', function (Blueprint $table) {
            $table->boolean('is_active')->default(true)->after('is_default');
        });
    }

    public function down(): void
    {
        if (Schema::hasTable('softphone_devices') && Schema::hasColumn('softphone_devices', 'is_active')) {
            Schema::table('softphone_devices', function (Blueprint $table) {
                $table->dropColumn('is_active');
            });
        }
    }
};
