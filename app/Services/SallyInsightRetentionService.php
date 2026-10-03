<?php

namespace App\Services;

use App\Models\SallyMeetingInsight;

/**
 * Retention for Sally meeting insights.
 *
 * Transcripts are client conversations, so they must not outlive the record
 * that identifies the client — but the two parents delete in different ways,
 * which is why this cannot be expressed as a foreign key:
 *
 * - Lead soft-deletes, so an ON DELETE CASCADE foreign key would never fire
 *   for the ordinary "delete this lead" action, leaving the transcript behind.
 * - Deal hard-deletes, so cascading there *would* fire — and would destroy a
 *   transcript whose lead is still perfectly alive, because most insights
 *   carry both ids.
 *
 * So the rule is ownership, not reachability:
 *   - deleting a lead purges its insights outright;
 *   - deleting a deal detaches it (deal_id = null) and only purges insights
 *     that no lead owns, since the deal was their last reference.
 *
 * Both are driven from LeadObserver / DealObserver, which fire for soft and
 * hard deletes alike.
 */
class SallyInsightRetentionService
{
    /** Called when a lead is soft- or hard-deleted: purge its transcripts. */
    public function purgeForLead(int $leadId): int
    {
        return SallyMeetingInsight::query()
            ->where('lead_id', $leadId)
            ->delete();
    }

    /** Called when a deal is deleted: detach, and purge only unowned rows. */
    public function purgeForDeal(int $dealId): void
    {
        // Still owned by a live lead — the transcript stays readable there.
        SallyMeetingInsight::query()
            ->where('deal_id', $dealId)
            ->whereNotNull('lead_id')
            ->update(['deal_id' => null]);

        // The deal was the only reference left, so nothing would reach these.
        SallyMeetingInsight::query()
            ->where('deal_id', $dealId)
            ->whereNull('lead_id')
            ->delete();
    }
}