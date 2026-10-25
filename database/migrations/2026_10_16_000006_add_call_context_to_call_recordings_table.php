<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Records *why* a call reached the agent — the matched lead's name, the number
 * dialled, the direction and the routing decision (owner-first vs pool
 * fallback vs unmatched). Without this a recording could not be tied back to
 * the call that produced it.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('call_recordings', function (Blueprint $table) {
            if (! Schema::hasColumn('call_recordings', 'lead_name')) {
                $table->string('lead_name', 180)->nullable()->after('entity_id');
            }
            if (! Schema::hasColumn('call_recordings', 'phone_number')) {
                $table->string('phone_number', 50)->nullable()->after('lead_name');
            }
            if (! Schema::hasColumn('call_recordings', 'direction')) {
                $table->string('direction', 20)->nullable()->after('phone_number');
            }
            if (! Schema::hasColumn('call_recordings', 'routing_reason')) {
                $table->string('routing_reason', 40)->nullable()->after('direction');
            }
        });
    }

    public function down(): void
    {
        Schema::table('call_recordings', function (Blueprint $table) {
            $columns = array_values(array_filter(
                ['lead_name', 'phone_number', 'direction', 'routing_reason'],
                fn ($c) => Schema::hasColumn('call_recordings', $c),
            ));

            if ($columns !== []) {
                $table->dropColumn($columns);
            }
        });
    }
};
