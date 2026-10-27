<?php

namespace App\Services;

use App\Models\Deal;
use App\Models\Lead;
use App\Models\SallyMeetingInsight;
use App\Scopes\CompanyScope;

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
        // Directly linked insights.
        $deleted = SallyMeetingInsight::query()
            ->where('lead_id', $leadId)
            ->delete();

        // Insights with no direct lead link but whose deal belongs to this lead
        // (e.g. ingested through a meeting that only carried a deal_id).
        $dealIds = Deal::withoutGlobalScope(CompanyScope::class)
            ->where('lead_id', $leadId)
            ->pluck('id');

        if ($dealIds->isNotEmpty()) {
            $deleted += SallyMeetingInsight::query()
                ->whereNull('lead_id')
                ->whereIn('deal_id', $dealIds->all())
                ->delete();
        }

        return $deleted;
    }

    /** Called when a deal is deleted: detach, and purge only unowned rows. */
    public function purgeForDeal(int $dealId): void
    {
        $deal = Deal::withoutGlobalScope(CompanyScope::class)->find($dealId);

        if ($deal === null) {
            return;
        }

        $lead = $deal->lead;

        // Insights whose deal was their last reference and have no lead link
        // are unreferenced — purge outright.
        SallyMeetingInsight::query()
            ->where('deal_id', $dealId)
            ->whereNull('lead_id')
            ->delete();

        // Insights also linked to a lead: detach from the deal only if the lead
        // is still live; if the lead is soft-deleted or missing, purge them too.
        $owned = SallyMeetingInsight::query()
            ->where('deal_id', $dealId)
            ->whereNotNull('lead_id')
            ->get();

        foreach ($owned as $insight) {
            $insightLead = Lead::withoutGlobalScope(CompanyScope::class)->find($insight->lead_id);

            if ($insightLead === null || $insightLead->trashed()) {
                $insight->delete();
            } else {
                $insight->update(['deal_id' => null]);
            }
        }
    }
}
