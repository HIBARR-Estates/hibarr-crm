<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Voicemail calls were stored with status "completed", so they read as a
 * finished conversation. They now have their own "voicemail" status; this
 * moves the existing ones over.
 */
return new class extends Migration
{
    public function up(): void
    {
        $this->move('completed', 'voicemail');
    }

    public function down(): void
    {
        $this->move('voicemail', 'completed');
    }

    private function move(string $from, string $to): void
    {
        if (! Schema::hasTable('crm_events') || ! Schema::hasTable('crm_event_types')) {
            return;
        }

        $typeIds = DB::table('crm_event_types')->where('slug', 'call_voicemail')->pluck('id');
        if ($typeIds->isEmpty()) {
            return;
        }

        DB::table('crm_events')
            ->whereIn('event_type_id', $typeIds)
            ->where('status', $from)
            ->update(['status' => $to]);
    }
};
