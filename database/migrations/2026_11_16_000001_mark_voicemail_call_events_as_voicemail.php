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
        $this->moveVoicemailCalls();
    }

    /**
     * The previous code has no "voicemail" status, so every row carrying it
     * (whatever its type) goes back to "completed" — otherwise it could not
     * be read at all.
     */
    public function down(): void
    {
        if (Schema::hasTable('crm_events')) {
            DB::table('crm_events')->where('status', 'voicemail')->update(['status' => 'completed']);
        }
    }

    private function moveVoicemailCalls(): void
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
            ->where('status', 'completed')
            ->update(['status' => 'voicemail']);
    }
};
