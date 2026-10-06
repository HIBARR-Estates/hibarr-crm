<?php

namespace App\Services;

use App\Models\DealFollowUp;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Keeps a deal's meetings (rows in `lead_follow_up`) linked to the deal's lead.
 *
 * Rule: when a meeting has a deal_id and that deal has a lead, the meeting's
 * lead_id IS the deal's lead_id. A deal with no lead leaves the meeting's
 * lead_id untouched (there is nothing to enforce).
 *
 * Two enforcement styles live here:
 *  - apply(): per-model, called from DealFollowUp's `saving` hook.
 *  - sync*(): set-based UPDATEs for paths that bypass model events (deal
 *    re-link, lead merge, backfill). They deliberately use the query builder so
 *    no observers, notifications or calendar syncs fire and updated_at is not
 *    touched — only the link is repaired.
 */
class DealMeetingLeadLinker
{
    /**
     * Force the follow-up's lead_id to its deal's lead when one exists.
     */
    public function apply(DealFollowUp $followUp): void
    {
        if (! $followUp->deal_id) {
            return;
        }

        $leadId = $this->leadIdForDeal((int) $followUp->deal_id);

        if ($leadId !== null && (int) $followUp->lead_id !== $leadId) {
            $followUp->lead_id = $leadId;
        }
    }

    /**
     * The deal's lead id, ignoring global scopes (company/active) so it works
     * from queues, console and API contexts alike.
     */
    public function leadIdForDeal(int $dealId): ?int
    {
        // Join leads so a dangling deals.lead_id can never be copied onto a
        // meeting (lead_follow_up.lead_id has a foreign key to leads).
        // A failed lookup must never block saving a meeting: report and skip.
        try {
            $leadId = DB::table('deals')
                ->join('leads', 'leads.id', '=', 'deals.lead_id')
                ->where('deals.id', $dealId)
                ->value('deals.lead_id');
        } catch (QueryException $e) {
            report($e);

            return null;
        }

        return $leadId === null ? null : (int) $leadId;
    }

    /**
     * Repair every meeting of one deal. Returns the number of rows changed.
     */
    public function syncDeal(int $dealId): int
    {
        return $this->sync(fn ($q) => $q->where('lead_follow_up.deal_id', $dealId));
    }

    /**
     * Repair every meeting of every deal currently linked to the given lead.
     */
    public function syncLead(int $leadId): int
    {
        return $this->sync(fn ($q) => $q->whereIn(
            'lead_follow_up.deal_id',
            fn ($sub) => $sub->select('id')->from('deals')->where('lead_id', $leadId)
        ));
    }

    /**
     * Repair (or, with $dryRun, just count) every drifted meeting.
     */
    public function syncAll(bool $dryRun = false): int
    {
        return $this->sync(null, $dryRun);
    }

    /**
     * @param  (callable(\Illuminate\Database\Query\Builder): mixed)|null  $constrain
     */
    private function sync(?callable $constrain, bool $dryRun = false): int
    {
        if (! Schema::hasColumn('lead_follow_up', 'deal_id')
            || ! Schema::hasColumn('lead_follow_up', 'lead_id')) {
            return 0;
        }

        $query = DB::table('lead_follow_up')
            ->whereNotNull('lead_follow_up.deal_id')
            ->whereExists(function ($exists) {
                $exists->select(DB::raw(1))
                    ->from('deals')
                    ->whereColumn('deals.id', 'lead_follow_up.deal_id')
                    ->whereNotNull('deals.lead_id')
                    ->whereExists(function ($lead) {
                        $lead->select(DB::raw(1))
                            ->from('leads')
                            ->whereColumn('leads.id', 'deals.lead_id');
                    })
                    ->where(function ($w) {
                        $w->whereNull('lead_follow_up.lead_id')
                            ->orWhereColumn('lead_follow_up.lead_id', '!=', 'deals.lead_id');
                    });
            });

        if ($constrain) {
            $constrain($query);
        }

        if ($dryRun) {
            return $query->count();
        }

        return $query->update([
            'lead_id' => DB::raw('(select deals.lead_id from deals where deals.id = lead_follow_up.deal_id)'),
        ]);
    }
}
