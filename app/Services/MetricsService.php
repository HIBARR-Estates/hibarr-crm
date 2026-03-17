<?php

namespace App\Services;

use App\Models\AgentCycleMetric;
use App\Models\AgentHierarchy;
use App\Models\AgentMetric;
use App\Models\Deal;
use App\Models\LeadAgent;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class MetricsService
{
    protected HierarchyService $hierarchyService;
    protected CycleService $cycleService;

    public function __construct(HierarchyService $hierarchyService, CycleService $cycleService)
    {
        $this->hierarchyService = $hierarchyService;
        $this->cycleService = $cycleService;
    }

    /**
     * Increment metrics when a deal is won.
     *
     * - Increments Agent's NSA and VSA (all-time + cycle)
     * - Increments all ancestors' NSD and VSD (all-time + their active cycle)
     * - Sets won_at on the deal for cycle attribution
     */
    public function incrementOnDealWon(Deal $deal): void
    {
        $agentId = $deal->agent_id;

        if (!$agentId) {
            Log::warning("MetricsService: Deal {$deal->id} has no agent_id, skipping metrics update");
            return;
        }

        $agent = LeadAgent::find($agentId);

        if (!$agent) {
            Log::warning("MetricsService: Agent {$agentId} not found for deal {$deal->id}");
            return;
        }

        $dealValue = (float) ($deal?->value ?? 0);

        // Set won_at for cycle attribution
        if (!$deal->won_at) {
            $deal->won_at = now();
            $deal->saveQuietly();
        }

        // ── All-time metrics (existing behavior) ─────────────────
        $metrics = $this->getOrCreateMetrics($agent);
        $metrics->increment('nsa', 1);
        $metrics->increment('vsa', $dealValue);

        Log::info("MetricsService: Agent {$agentId} all-time NSA+1, VSA+{$dealValue} for deal {$deal->id}");

        // ── Cycle metrics (new) ──────────────────────────────────
        $cycleMetrics = $this->cycleService->getOrCreateCycleMetrics($agent);
        if ($cycleMetrics) {
            $cycleMetrics->increment('nsa', 1);
            $cycleMetrics->increment('vsa', $dealValue);
            Log::info("MetricsService: Agent {$agentId} cycle NSA+1, VSA+{$dealValue} (enrollment {$cycleMetrics->enrollment_id})");
        }

        // ── Ancestor metrics (all-time + cycle) ──────────────────
        $ancestorIds = AgentHierarchy::where('descendant_id', $agent->id)
            ->pluck('ancestor_id')
            ->toArray();

        if (!empty($ancestorIds)) {
            // All-time bulk update
            AgentMetric::whereIn('agent_id', $ancestorIds)
                ->update([
                    'nsd' => DB::raw('nsd + 1'),
                    'vsd' => DB::raw("vsd + {$dealValue}"),
                ]);

            // Ensure all-time metrics rows exist for ancestors that don't have them yet
            $existingIds = AgentMetric::whereIn('agent_id', $ancestorIds)->pluck('agent_id')->toArray();
            $missingIds = array_diff($ancestorIds, $existingIds);

            foreach ($missingIds as $missingId) {
                $ancestorAgent = LeadAgent::find($missingId);
                if ($ancestorAgent) {
                    AgentMetric::create([
                        'company_id' => $ancestorAgent->company_id,
                        'agent_id' => $missingId,
                        'nsa' => 0,
                        'nsd' => 1,
                        'vsa' => 0,
                        'vsd' => $dealValue,
                    ]);
                }
            }

            // Cycle metrics for each ancestor — credits go to the UPLINE'S own active enrollment
            foreach ($ancestorIds as $ancestorId) {
                $ancestorAgent = LeadAgent::find($ancestorId);
                if (!$ancestorAgent) {
                    continue;
                }

                $ancestorCycleMetrics = $this->cycleService->getOrCreateCycleMetrics($ancestorAgent);
                if ($ancestorCycleMetrics) {
                    $ancestorCycleMetrics->increment('nsd', 1);
                    $ancestorCycleMetrics->increment('vsd', $dealValue);
                }
            }

            Log::info("MetricsService: Updated NSD/VSD for " . count($ancestorIds) . " ancestors of agent {$agentId}");
        }
    }

    /**
     * Decrement metrics when a deal commission is reverted.
     * Decrements both all-time and cycle metrics.
     */
    public function decrementOnDealReverted(Deal $deal): void
    {
        $agentId = $deal->agent_id;

        if (!$agentId) {
            return;
        }

        $agent = LeadAgent::find($agentId);

        if (!$agent) {
            return;
        }

        $dealValue = (float) ($deal?->value ?? 0);

        // ── All-time metrics ─────────────────────────────────────
        $metrics = $this->getOrCreateMetrics($agent);
        $metrics->decrement('nsa', min(1, $metrics->nsa));
        $metrics->decrement('vsa', min($dealValue, $metrics->vsa));

        // ── Cycle metrics ────────────────────────────────────────
        // Find the cycle metric that was incremented for this deal
        // Use the agent's active enrollment since that's where the deal was counted
        $cycleMetrics = $this->cycleService->getOrCreateCycleMetrics($agent);
        if ($cycleMetrics) {
            $cycleMetrics->decrement('nsa', min(1, $cycleMetrics->nsa));
            $cycleMetrics->decrement('vsa', min($dealValue, (float) $cycleMetrics->vsa));
        }

        // ── Ancestor all-time + cycle ────────────────────────────
        $ancestorIds = AgentHierarchy::where('descendant_id', $agent->id)
            ->pluck('ancestor_id')
            ->toArray();

        if (!empty($ancestorIds)) {
            // All-time bulk update
            AgentMetric::whereIn('agent_id', $ancestorIds)
                ->update([
                    'nsd' => DB::raw('GREATEST(CAST(nsd AS SIGNED) - 1, 0)'),
                    'vsd' => DB::raw("GREATEST(vsd - {$dealValue}, 0)"),
                ]);

            // Cycle metrics for each ancestor
            foreach ($ancestorIds as $ancestorId) {
                $ancestorAgent = LeadAgent::find($ancestorId);
                if (!$ancestorAgent) {
                    continue;
                }

                $ancestorCycleMetrics = $this->cycleService->getOrCreateCycleMetrics($ancestorAgent);
                if ($ancestorCycleMetrics) {
                    $ancestorCycleMetrics->decrement('nsd', min(1, $ancestorCycleMetrics->nsd));
                    $ancestorCycleMetrics->decrement('vsd', min($dealValue, (float) $ancestorCycleMetrics->vsd));
                }
            }
        }

        Log::info("MetricsService: Decremented metrics for deal {$deal->id} revert");
    }

    /**
     * Full recalculation of all-time metrics for an agent from deal data.
     */
    public function recalculateForAgent(LeadAgent $agent): AgentMetric
    {
        $metrics = $this->getOrCreateMetrics($agent);

        // Recalculate own sales (NSA, VSA)
        $ownDeals = Deal::where('agent_id', $agent->id)
            ->where('outcome_status', 'won')
            ->selectRaw('COUNT(*) as deal_count, COALESCE(SUM(COALESCE(value, 0)), 0) as deal_value')
            ->first();

        $metrics->nsa = $ownDeals->deal_count ?? 0;
        $metrics->vsa = $ownDeals->deal_value ?? 0;

        // Recalculate downline sales (NSD, VSD) from hierarchy
        $descendantIds = AgentHierarchy::where('ancestor_id', $agent->id)
            ->pluck('descendant_id')
            ->toArray();

        if (!empty($descendantIds)) {
            $downlineDeals = Deal::whereIn('agent_id', $descendantIds)
                ->where('outcome_status', 'won')
                ->selectRaw('COUNT(*) as deal_count, COALESCE(SUM(COALESCE(value, 0)), 0) as deal_value')
                ->first();

            $metrics->nsd = $downlineDeals->deal_count ?? 0;
            $metrics->vsd = $downlineDeals->deal_value ?? 0;
        } else {
            $metrics->nsd = 0;
            $metrics->vsd = 0;
        }

        $metrics->save();

        Log::info("MetricsService: Recalculated all-time metrics for agent {$agent->id}: NSA={$metrics->nsa}, NSD={$metrics->nsd}, VSA={$metrics->vsa}, VSD={$metrics->vsd}");

        return $metrics;
    }

    /**
     * Recalculate cycle metrics for a specific enrollment from deal data.
     * Only counts deals whose won_at falls within the enrollment's effective date range.
     */
    public function recalculateForEnrollment(\App\Models\AgentCycleEnrollment $enrollment): ?AgentCycleMetric
    {
        $agent = $enrollment->agent;
        $dateRange = $enrollment->getMetricDateRange();
        $startDate = $dateRange['start'];
        $endDate = $dateRange['end'];

        $cycleMetrics = $enrollment->metrics ?? AgentCycleMetric::create([
            'company_id' => $enrollment->company_id,
            'enrollment_id' => $enrollment->id,
            'agent_id' => $agent->id,
            'nsa' => 0,
            'nsd' => 0,
            'vsa' => 0,
            'vsd' => 0,
        ]);

        // Recalculate own sales within the enrollment date range
        $ownDeals = Deal::where('agent_id', $agent->id)
            ->where('outcome_status', 'won')
            ->whereBetween('won_at', [$startDate->startOfDay(), $endDate->endOfDay()])
            ->selectRaw('COUNT(*) as deal_count, COALESCE(SUM(COALESCE(value, 0)), 0) as deal_value')
            ->first();

        $cycleMetrics->nsa = $ownDeals->deal_count ?? 0;
        $cycleMetrics->vsa = $ownDeals->deal_value ?? 0;

        // Recalculate downline sales within the enrollment date range
        $descendantIds = AgentHierarchy::where('ancestor_id', $agent->id)
            ->pluck('descendant_id')
            ->toArray();

        if (!empty($descendantIds)) {
            $downlineDeals = Deal::whereIn('agent_id', $descendantIds)
                ->where('outcome_status', 'won')
                ->whereBetween('won_at', [$startDate->startOfDay(), $endDate->endOfDay()])
                ->selectRaw('COUNT(*) as deal_count, COALESCE(SUM(COALESCE(value, 0)), 0) as deal_value')
                ->first();

            $cycleMetrics->nsd = $downlineDeals->deal_count ?? 0;
            $cycleMetrics->vsd = $downlineDeals->deal_value ?? 0;
        } else {
            $cycleMetrics->nsd = 0;
            $cycleMetrics->vsd = 0;
        }

        $cycleMetrics->save();

        Log::info("MetricsService: Recalculated cycle metrics for enrollment {$enrollment->id} (agent {$agent->id}): NSA={$cycleMetrics->nsa}, NSD={$cycleMetrics->nsd}, VSA={$cycleMetrics->vsa}, VSD={$cycleMetrics->vsd}");

        return $cycleMetrics;
    }

    /**
     * Get or create the AgentMetric record.
     */
    public function getOrCreateMetrics(LeadAgent $agent): AgentMetric
    {
        return AgentMetric::firstOrCreate(
            ['agent_id' => $agent->id],
            [
                'company_id' => $agent->company_id,
                'nsa' => 0,
                'nsd' => 0,
                'vsa' => 0,
                'vsd' => 0,
            ]
        );
    }
}
