<?php

namespace App\Services;

use App\Models\AgentHierarchy;
use App\Models\AgentMetric;
use App\Models\Deal;
use App\Models\LeadAgent;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class MetricsService
{
    protected HierarchyService $hierarchyService;

    public function __construct(HierarchyService $hierarchyService)
    {
        $this->hierarchyService = $hierarchyService;
    }

    /**
     * Increment metrics when a deal is won.
     *
     * - Increments Agent's NSA and VSA
     * - Increments all ancestors' NSD and VSD
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

        $dealValue = (float) ($deal->total_value ?? $deal->value ?? 0);

        // Update the agent's own metrics (NSA, VSA)
        $metrics = $this->getOrCreateMetrics($agent);
        $metrics->increment('nsa', 1);
        $metrics->increment('vsa', $dealValue);

        Log::info("MetricsService: Agent {$agentId} NSA+1, VSA+{$dealValue} for deal {$deal->id}");

        // Update all ancestors' downline metrics (NSD, VSD)
        $ancestorIds = AgentHierarchy::where('descendant_id', $agent->id)
            ->pluck('ancestor_id')
            ->toArray();

        if (!empty($ancestorIds)) {
            // Bulk update all ancestors at once
            AgentMetric::whereIn('agent_id', $ancestorIds)
                ->update([
                    'nsd' => DB::raw('nsd + 1'),
                    'vsd' => DB::raw("vsd + {$dealValue}"),
                ]);

            // Ensure metrics rows exist for ancestors that don't have them yet
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

            Log::info("MetricsService: Updated NSD/VSD for " . count($ancestorIds) . " ancestors of agent {$agentId}");
        }
    }

    /**
     * Decrement metrics when a deal commission is reverted.
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

        $dealValue = (float) ($deal->total_value ?? $deal->value ?? 0);

        // Decrement agent's own metrics
        $metrics = $this->getOrCreateMetrics($agent);
        $metrics->decrement('nsa', min(1, $metrics->nsa));
        $metrics->decrement('vsa', min($dealValue, $metrics->vsa));

        // Decrement ancestors' downline metrics
        $ancestorIds = AgentHierarchy::where('descendant_id', $agent->id)
            ->pluck('ancestor_id')
            ->toArray();

        if (!empty($ancestorIds)) {
            // Use GREATEST to prevent negative values
            AgentMetric::whereIn('agent_id', $ancestorIds)
                ->update([
                    'nsd' => DB::raw('GREATEST(CAST(nsd AS SIGNED) - 1, 0)'),
                    'vsd' => DB::raw("GREATEST(vsd - {$dealValue}, 0)"),
                ]);
        }

        Log::info("MetricsService: Decremented metrics for deal {$deal->id} revert");
    }

    /**
     * Full recalculation of metrics for an agent from deal data.
     */
    public function recalculateForAgent(LeadAgent $agent): AgentMetric
    {
        $metrics = $this->getOrCreateMetrics($agent);

        // Recalculate own sales (NSA, VSA)
        $ownDeals = Deal::where('agent_id', $agent->id)
            ->where('outcome_status', 'won')
            ->selectRaw('COUNT(*) as deal_count, COALESCE(SUM(COALESCE(total_value, value, 0)), 0) as deal_value')
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
                ->selectRaw('COUNT(*) as deal_count, COALESCE(SUM(COALESCE(total_value, value, 0)), 0) as deal_value')
                ->first();

            $metrics->nsd = $downlineDeals->deal_count ?? 0;
            $metrics->vsd = $downlineDeals->deal_value ?? 0;
        } else {
            $metrics->nsd = 0;
            $metrics->vsd = 0;
        }

        $metrics->save();

        Log::info("MetricsService: Recalculated metrics for agent {$agent->id}: NSA={$metrics->nsa}, NSD={$metrics->nsd}, VSA={$metrics->vsa}, VSD={$metrics->vsd}");

        return $metrics;
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
