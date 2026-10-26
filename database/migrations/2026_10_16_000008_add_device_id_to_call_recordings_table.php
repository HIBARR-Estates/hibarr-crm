<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Records which channel/line a call recording was captured on, so the Call
 * Bridge settings page can group recordings per line instead of flat-listing
 * them.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('call_recordings', function (Blueprint $table) {
            if (! Schema::hasColumn('call_recordings', 'device_id')) {
                $table->unsignedBigInteger('device_id')->nullable()->after('lead_name');
                $table->index(['company_id', 'device_id']);
            }
        });
    }

    public function down(): void
    {
        Schema::table('call_recordings', function (Blueprint $table) {
            if (Schema::hasColumn('call_recordings', 'device_id')) {
                $table->dropIndex(['company_id', 'device_id']);
                $table->dropColumn('device_id');
            }
        });
    }
};
