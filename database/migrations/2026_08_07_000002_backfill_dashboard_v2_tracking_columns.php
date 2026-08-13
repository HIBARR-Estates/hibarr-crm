<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Seeds the v2 tracking columns from history so the dashboards aren't blank on
 * day one. Necessarily partial: crm_events only goes back to March 2026 and is
 * subject to the retention policy, so older leads keep a NULL first_contacted_at
 * rather than a fabricated one. NULL means "unknown", not "never contacted" —
 * the SLA panel must exclude leads created before the events cutover.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Every statement below is a multi-table `UPDATE ... JOIN` or a JSON_*
        // call, neither of which SQLite has. Skipping on other drivers is
        // correct rather than merely convenient: this seeds history, and a test
        // database built from scratch has none to seed.
        if (DB::connection()->getDriverName() !== 'mysql') {
            return;
        }

        $this->repairStrippedModelTypes();
        $this->backfillFirstContactedAt();
        $this->backfillAssignedAt();
        $this->backfillStageEnteredAt();
        $this->backfillExchangeRate();
        $this->backfillPrimaryLanguage();
    }

    public function down(): void
    {
        // Data-only migration. The columns are dropped by the schema migration.
    }

    /**
     * Events whose model_type lost its backslashes in transit resolve to no model,
     * so they'd be skipped by every query below. Same recovery the API-side
     * normalizer now does — see CrmEventController::normalizeModelType().
     */
    private function repairStrippedModelTypes(): void
    {
        foreach ([\App\Models\Lead::class, \App\Models\Deal::class] as $class) {
            DB::table('crm_events')
                ->where('model_type', str_replace('\\', '', $class))
                ->update(['model_type' => $class]);
        }
    }

    /**
     * Earliest agent-originated activity per lead, from the event log plus the
     * note and follow-up tables (which predate the event log).
     */
    private function backfillFirstContactedAt(): void
    {
        $slugs = config('crm_events.first_contact.slugs', []);

        if (! empty($slugs)) {
            $placeholders = implode(',', array_fill(0, count($slugs), '?'));

            // Events recorded directly against a lead.
            DB::statement('
                UPDATE leads l
                JOIN (
                    SELECT e.model_id AS lead_id, MIN(e.occurred_at) AS first_at
                    FROM crm_events e
                    JOIN crm_event_types et ON et.id = e.event_type_id
                    WHERE et.slug IN ('.$placeholders.') AND e.model_type = ?
                    GROUP BY e.model_id
                ) f ON f.lead_id = l.id
                SET l.first_contacted_at = f.first_at
                WHERE l.first_contacted_at IS NULL OR f.first_at < l.first_contacted_at
            ', array_merge($slugs, [\App\Models\Lead::class]));

            // Events recorded against a deal, resolved back through deals.lead_id.
            DB::statement('
                UPDATE leads l
                JOIN (
                    SELECT d.lead_id AS lead_id, MIN(e.occurred_at) AS first_at
                    FROM crm_events e
                    JOIN crm_event_types et ON et.id = e.event_type_id
                    JOIN deals d ON d.id = e.model_id
                    WHERE et.slug IN ('.$placeholders.') AND e.model_type = ?
                      AND d.lead_id IS NOT NULL
                    GROUP BY d.lead_id
                ) f ON f.lead_id = l.id
                SET l.first_contacted_at = f.first_at
                WHERE l.first_contacted_at IS NULL OR f.first_at < l.first_contacted_at
            ', array_merge($slugs, [\App\Models\Deal::class]));
        }

        // Notes and follow-ups predate the event log entirely.
        DB::statement('
            UPDATE leads l
            JOIN (SELECT lead_id, MIN(created_at) AS first_at FROM lead_notes GROUP BY lead_id) n
              ON n.lead_id = l.id
            SET l.first_contacted_at = n.first_at
            WHERE l.first_contacted_at IS NULL OR n.first_at < l.first_contacted_at
        ');

        DB::statement('
            UPDATE leads l
            JOIN (
                SELECT COALESCE(f.lead_id, d.lead_id) AS lead_id, MIN(f.created_at) AS first_at
                FROM lead_follow_up f
                LEFT JOIN deals d ON d.id = f.deal_id
                GROUP BY COALESCE(f.lead_id, d.lead_id)
            ) fu ON fu.lead_id = l.id
            SET l.first_contacted_at = fu.first_at
            WHERE fu.lead_id IS NOT NULL
              AND (l.first_contacted_at IS NULL OR fu.first_at < l.first_contacted_at)
        ');
    }

    /**
     * No assignment history exists, so approximate with the lead's own created_at
     * for leads that already have an owner. Wrong for anything reassigned later,
     * but it keeps time-to-assign from reading as "never assigned".
     */
    private function backfillAssignedAt(): void
    {
        DB::statement('
            UPDATE leads
            SET assigned_at = created_at
            WHERE lead_owner IS NOT NULL AND assigned_at IS NULL
        ');
    }

    private function backfillStageEnteredAt(): void
    {
        DB::statement('
            UPDATE deals d
            JOIN (
                SELECT e.model_id AS deal_id, MAX(e.occurred_at) AS entered_at
                FROM crm_events e
                JOIN crm_event_types et ON et.id = e.event_type_id
                WHERE et.slug = ? AND e.model_type = ?
                GROUP BY e.model_id
            ) s ON s.deal_id = d.id
            SET d.stage_entered_at = s.entered_at
            WHERE d.stage_entered_at IS NULL
        ', ['deal_stage_changed', \App\Models\Deal::class]);

        // Deals that never changed stage entered it when they were created.
        DB::statement('
            UPDATE deals SET stage_entered_at = created_at WHERE stage_entered_at IS NULL
        ');
    }

    /**
     * Best available approximation: today's rate. It is wrong for historical
     * deals — but from here forward the rate stops moving under them, which is
     * the point of the column.
     */
    private function backfillExchangeRate(): void
    {
        DB::statement('
            UPDATE deals d
            JOIN currencies c ON c.id = d.currency_id
            SET d.exchange_rate = c.exchange_rate
            WHERE d.exchange_rate IS NULL AND c.exchange_rate IS NOT NULL
        ');
    }

    /**
     * First entry of the languages array. Order isn't guaranteed meaningful, so
     * this is a starting point for the segmentation cut, not a truth — expect to
     * correct it in the UI.
     */
    private function backfillPrimaryLanguage(): void
    {
        if (! Schema::hasColumn('leads', 'languages')) {
            return;
        }

        DB::statement('
            UPDATE leads
            SET primary_language = JSON_UNQUOTE(JSON_EXTRACT(languages, "$[0]"))
            WHERE primary_language IS NULL
              AND languages IS NOT NULL
              AND JSON_LENGTH(languages) > 0
        ');
    }
};
