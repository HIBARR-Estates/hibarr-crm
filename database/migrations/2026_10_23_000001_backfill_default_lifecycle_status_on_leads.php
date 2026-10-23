<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Leads created through the external API (contact/create, deal/create) and
 * the Bitrix import were saved with saveQuietly(), which skips
 * LeadObserver::creating — the only place the company's default ("new")
 * lifecycle status was assigned. Those leads have no status, so they match
 * no status filter and drop out of status-based dashboard counts.
 *
 * Give every status-less lead its company's default status. Companies
 * without a default status are left alone, same as the observer.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (
            ! Schema::hasTable('leads')
            || ! Schema::hasTable('lead_lifecycle_statuses')
            || ! Schema::hasColumn('leads', 'lead_lifecycle_status_id')
        ) {
            return;
        }

        $defaults = DB::table('lead_lifecycle_statuses')
            ->where('key', 'new')
            ->pluck('id', 'company_id');

        foreach ($defaults as $companyId => $statusId) {
            DB::table('leads')
                ->where('company_id', $companyId)
                ->whereNull('lead_lifecycle_status_id')
                ->update(['lead_lifecycle_status_id' => $statusId]);
        }
    }

    public function down(): void
    {
        // Data backfill — not reversed. Once backfilled, these leads can't be
        // told apart from ones that legitimately carry the default status.
    }
};
