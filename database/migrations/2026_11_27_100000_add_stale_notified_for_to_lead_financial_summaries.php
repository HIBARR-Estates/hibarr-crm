<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Remembers which refresh-due date the "financial assessment stale" automation
 * trigger has already fired for, so it fires once per assessment rather than on
 * every daily scan. A new final assessment gets a new due date, so it re-arms
 * by itself.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('lead_financial_summaries') && ! Schema::hasColumn('lead_financial_summaries', 'stale_notified_for')) {
            Schema::table('lead_financial_summaries', function (Blueprint $table) {
                $table->date('stale_notified_for')->nullable()->after('refresh_due_on');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('lead_financial_summaries', 'stale_notified_for')) {
            Schema::table('lead_financial_summaries', function (Blueprint $table) {
                $table->dropColumn('stale_notified_for');
            });
        }
    }
};
