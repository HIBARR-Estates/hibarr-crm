<?php

use App\Services\CallLog\CallKey;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Stores which call each `call_*` event belongs to, so the call log groups
 * every agent's leg of a call on one indexed column instead of working the
 * identity out with subqueries on every request.
 *
 * Existing call events are keyed here in chunks; new ones are keyed when they
 * are written (CrmEvent::created). Re-running only fills rows still missing
 * a key.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('crm_events')) {
            return;
        }

        if (! Schema::hasColumn('crm_events', 'call_key')) {
            Schema::table('crm_events', function (Blueprint $table) {
                // Nullable and appended last, so MySQL adds it without a table rebuild.
                $table->string('call_key', 191)->nullable();
                $table->index(['company_id', 'call_key'], 'crm_events_company_call_key_index');
            });
        }

        app(CallKey::class)->backfill();
    }

    public function down(): void
    {
        if (! Schema::hasTable('crm_events') || ! Schema::hasColumn('crm_events', 'call_key')) {
            return;
        }

        Schema::table('crm_events', function (Blueprint $table) {
            $table->dropIndex('crm_events_company_call_key_index');
            $table->dropColumn('call_key');
        });
    }
};
