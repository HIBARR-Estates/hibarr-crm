<?php

use App\Services\DealMeetingLeadLinker;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * One-off repair: meetings created through paths that skipped the lead link
     * (external meeting ingestion) or left behind by deal re-links.
     * Idempotent; also available as `php artisan meetings:sync-deal-leads`.
     */
    public function up(): void
    {
        if (! Schema::hasTable('lead_follow_up') || ! Schema::hasTable('deals') || ! Schema::hasTable('leads')) {
            return;
        }

        app(DealMeetingLeadLinker::class)->syncAll();
    }

    public function down(): void
    {
        // Data repair only; nothing to revert.
    }
};
