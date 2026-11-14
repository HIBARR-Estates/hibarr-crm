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
 * Give those leads their company's default status. Companies without a
 * default status are left alone, same as the observer.
 *
 * A lead whose status a user cleared is also status-less, but that change
 * went through LeadObserver::updated, which records a
 * lead_lifecycle_status_changed CRM event. Leads with such an event are
 * skipped, so a deliberately cleared status stays cleared. (Clears from
 * before CRM events existed, or via bulk update, left no event and can't be
 * told apart.)
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

        $hasEvents = Schema::hasTable('crm_events') && Schema::hasTable('crm_event_types');

        foreach ($defaults as $companyId => $statusId) {
            DB::table('leads')
                ->where('company_id', $companyId)
                ->whereNull('lead_lifecycle_status_id')
                ->when($hasEvents, fn ($query) => $query->whereNotExists(
                    fn ($events) => $this->statusChangeEvents($events)
                ))
                ->update(['lead_lifecycle_status_id' => $statusId]);
        }
    }

    /** Lifecycle status changes recorded against the outer `leads` row. */
    private function statusChangeEvents($query): void
    {
        $query->select(DB::raw(1))
            ->from('crm_events')
            ->join('crm_event_types', 'crm_event_types.id', '=', 'crm_events.event_type_id')
            ->where('crm_event_types.slug', 'lead_lifecycle_status_changed')
            ->where('crm_events.model_type', 'App\\Models\\Lead')
            ->whereColumn('crm_events.model_id', 'leads.id');
    }

    public function down(): void
    {
        // Data backfill — not reversed. Once backfilled, these leads can't be
        // told apart from ones that legitimately carry the default status.
    }
};
