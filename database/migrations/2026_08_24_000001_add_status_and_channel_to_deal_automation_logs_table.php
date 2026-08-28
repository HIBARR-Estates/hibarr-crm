<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('deal_automation_logs', function (Blueprint $table) {
            $table->string('status', 20)->default('success')->after('action');
            $table->string('channel', 20)->nullable()->after('status');
        });

        // Backfill existing rows from the free-text `action` description —
        // DealAutomationService::logAction() call sites already put these
        // exact words in the description whenever those outcomes occur.
        DB::table('deal_automation_logs')->where('action', 'like', '%failed%')->update(['status' => 'failed']);
        DB::table('deal_automation_logs')->where('action', 'like', '%skipped%')->update(['status' => 'skipped']);
        // Everything else already got 'success' from the column DEFAULT.

        // Best-effort channel backfill from the same text.
        foreach ([
            'stage' => 'Stage transition%',
            'field' => 'Set %',
            'lock' => 'Deal locked%',
            'email' => '%mail%',
            'task' => '%ask %',
            'note' => '%ote %',
            'meta' => '%eta Conversion%',
        ] as $channel => $pattern) {
            DB::table('deal_automation_logs')
                ->where('action', 'like', $pattern)
                ->whereNull('channel')
                ->update(['channel' => $channel]);
        }
    }

    public function down(): void
    {
        Schema::table('deal_automation_logs', function (Blueprint $table) {
            $table->dropColumn(['status', 'channel']);
        });
    }
};
