<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('softphone_devices', function (Blueprint $table) {
            // SIP platform the line belongs to (e.g. sipgate). The platform
            // decides the WebSocket endpoint and SIP URI for the device.
            $table->string('provider')->nullable()->after('label');
        });
    }

    public function down(): void
    {
        Schema::table('softphone_devices', function (Blueprint $table) {
            $table->dropColumn('provider');
        });
    }
};
