<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Links a recording to the call that produced it.
 *
 * The timeline writes `call_ref` onto the CRM event and the recording upload
 * carries the same value, so `call_ended` can be annotated with the recording
 * id once the (asynchronous) upload finishes.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('call_recordings', function (Blueprint $table) {
            if (! Schema::hasColumn('call_recordings', 'call_ref')) {
                $table->string('call_ref', 64)->nullable()->index()->after('routing_reason');
            }
        });
    }

    public function down(): void
    {
        Schema::table('call_recordings', function (Blueprint $table) {
            if (Schema::hasColumn('call_recordings', 'call_ref')) {
                $table->dropColumn('call_ref');
            }
        });
    }
};
