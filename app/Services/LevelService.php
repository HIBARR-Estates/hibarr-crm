<?php

namespace App\Services;

use App\Models\AgentLevelHistory;
use App\Models\AgentMetric;
use App\Models\Deal;
use App\Models\LeadAgent;
use App\Models\MlmCycle;
use App\Models\MlmLevel;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;

class LevelService
{
    protected HierarchyService $hierarchyService;
    protected MetricsService $metricsService;
    protected CycleService $cycleService;
    protected CycleLevelSnapshotService $snapshotService;

    public function __construct(HierarchyService $hierarchyService, MetricsService $metricsService, CycleService $cycleService, CycleLevelSnapshotService $snapshotService)
    {
        $this->hierarchyService = $hierarchyService;
        $this->metricsService = $metricsService;
        $this->cycleService = $cycleService;
        $this->snapshotService = $snapshotService;
    }

    /**
     * Evaluate whether the agent qualifies for a new (higher) level.
     *
     * Uses CYCLE metrics (from the agent's active enrollment) for evaluation.
     * When a cycle with snapshots is available, levels are read from the snapshot
     * instead of the live mlm_levels table.
     * Levels never demote — only promotes if the qualifying level is higher than current.
     *
     * @return MlmLevel|null The newly assigned level, or null if no change.
     */
    public function evaluate(LeadAgent $agent, ?Deal $triggerDeal = null, ?MlmCycle $cycle = null): ?MlmLevel
    {
        // Use cycle metrics for evaluation (primary), fall back to all-time if no enrollment
        $cycleMetrics = $this->cycleService->getOrCreateCycleMetrics($agent);
        $metricsForEvaluation = $cycleMetrics ?? $this->metricsService->getOrCreateMetrics($agent);

        $companyId = $agent->company_id;

        // Resolve the cycle if not provided
        if (!$cycle) {
            $enrollment = $this->cycleService->getActiveEnrollment($agent);
            $cycle = $enrollment?->cycle;
        }

        // Use snapshot levels if the cycle has them, otherwise fall back to live
        $useSnapshots = $cycle && $cycle->hasSnapshots();

        if ($useSnapshots) {
            return $this->evaluateWithSnapshots($agent, $metricsForEvaluation, $cycle, $triggerDeal);
        }

        // ── Fallback: live levels (no active cycle or no snapshots) ──
        $levels = MlmLevel::where('company_id', $companyId)
            ->orderedDesc()
            ->with('criteria')
            ->get();

        if ($levels->isEmpty()) {
            return null;
        }

        $currentLevel = $this->getCurrentLevel($agent);
        $currentRank = $currentLevel?->rank ?? -1;

        // Find the highest level the agent qualifies for
        $qualifiedLevel = null;

        foreach ($levels as $level) {
            if ($level->rank <= $currentRank) {
                // Already at or above this level, no need to check lower ones
                break;
            }

            if ($level->is_hidden) {
                continue;
            }

            if ($this->evaluateCriteria($metricsForEvaluation, $level->criteria)) {
                $qualifiedLevel = $level;
                break; // Found the highest qualifying level
            }
        }

        if ($qualifiedLevel) {
            $this->assignLevel(
                $agent,
                $qualifiedLevel,
                assignedBy: null,
                deal: $triggerDeal,
                systemAssigned: true
            );

            Log::info("LevelService: Agent {$agent->id} promoted to level '{$qualifiedLevel->name}' (rank {$qualifiedLevel->rank})");

            return $qualifiedLevel;
        }

        return null;
    }

    /**
     * Evaluate an agent and all their ancestors.
     * Called after a deal is won (since ancestor NSD/VSD changed).
     * Resolves the cycle from the agent's enrollment and passes it through.
     */
    public function evaluateWithAncestors(LeadAgent $agent, ?Deal $triggerDeal = null): void
    {
        // Resolve cycle once and reuse for all evaluations
        $enrollment = $this->cycleService->getActiveEnrollment($agent);
        $cycle = $enrollment?->cycle;

        // Evaluate the agent first
        $this->evaluate($agent, $triggerDeal, $cycle);

        // Evaluate all ancestors (their downline metrics changed)
        $ancestors = $this->hierarchyService->getAncestors($agent);

        foreach ($ancestors as $ancestor) {
            $this->evaluate($ancestor, $triggerDeal, $cycle);
        }
    }

    /**
     * Evaluate criteria for a level against metrics.
     *
     * Accepts both AgentMetric and AgentCycleMetric — both provide nsa/nsd/vsa/vsd.
     *
     * Logic groups:
     * - Conditions within the same logic_group are OR'd (any must pass)
     * - Different logic_groups are AND'd (all groups must pass)
     */
    public function evaluateCriteria(object $metrics, Collection $criteria): bool
    {
        if ($criteria->isEmpty()) {
            return false; // No criteria = cannot qualify
        }

        // Group by logic_group
        $groups = $criteria->groupBy('logic_group');

        foreach ($groups as $groupCriteria) {
            // Within a group: OR logic (at least one must pass)
            $anyPassed = false;

            foreach ($groupCriteria as $criterion) {
                if ($criterion->evaluate($metrics)) {
                    $anyPassed = true;
                    break;
                }
            }

            if (!$anyPassed) {
                return false; // AND logic: if any group fails, overall fails
            }
        }

        return true;
    }

    /**
     * Get the agent's current MLM level.
     */
    public function getCurrentLevel(LeadAgent $agent): ?MlmLevel
    {
        $latest = AgentLevelHistory::where('agent_id', $agent->id)
            ->orderByDesc('assigned_at')
            ->first();

        return $latest?->level;
    }

    /**
     * Manually or programmatically assign a level to an agent.
     */
    public function assignLevel(
        LeadAgent $agent,
        MlmLevel $level,
        ?int $assignedBy = null,
        ?Deal $deal = null,
        bool $systemAssigned = false,
        ?int $cycleLevelSnapshotId = null
    ): AgentLevelHistory {
        $currentLevel = $this->getCurrentLevel($agent);
        $oldRank = $currentLevel?->rank ?? -1;

        if (
            $level->rank > $oldRank
            && config('features.sales.per-agent-commission-override')
            && ($agent->custom_direct_rate !== null || $agent->custom_override_rate !== null)
        ) {
            app(AgentCommissionProfileService::class)->clearCustomRatesOnPromotion(
                $agent,
                $assignedBy,
                'Custom rates cleared on level promotion'
            );
        }

        return AgentLevelHistory::create([
            'company_id' => $agent->company_id,
            'agent_id' => $agent->id,
            'level_id' => $level->id,
            'cycle_level_snapshot_id' => $cycleLevelSnapshotId,
            'assigned_at' => now(),
            'assigned_by' => $assignedBy,
            'system_assigned' => $systemAssigned,
            'trigger_deal_id' => $deal?->id,
        ]);
    }

    /**
     * Evaluate using snapshot levels for the given cycle.
     */
    private function evaluateWithSnapshots(LeadAgent $agent, object $metrics, MlmCycle $cycle, ?Deal $triggerDeal): ?MlmLevel
    {
        $snapshotLevels = $this->snapshotService->getSnapshotLevels($cycle);

        if ($snapshotLevels->isEmpty()) {
            return null;
        }

        $currentLevel = $this->getCurrentLevel($agent);
        $currentRank = $currentLevel?->rank ?? -1;

        foreach ($snapshotLevels as $snapshot) {
            if ($snapshot->rank <= $currentRank) {
                break;
            }

            if ($snapshot->is_hidden) {
                continue;
            }

            if ($snapshot->evaluateCriteria($metrics)) {
                $liveLevel = $snapshot->source_level_id
                    ? MlmLevel::find($snapshot->source_level_id)
                    : null;

                if (!$liveLevel) {
                    Log::warning("LevelService: Snapshot #{$snapshot->id} references deleted source_level_id {$snapshot->source_level_id}, skipping.");
                    continue;
                }

                $this->assignLevel(
                    $agent,
                    $liveLevel,
                    assignedBy: null,
                    deal: $triggerDeal,
                    systemAssigned: true,
                    cycleLevelSnapshotId: $snapshot->id
                );

                Log::info("LevelService: Agent {$agent->id} promoted to level '{$liveLevel->name}' (rank {$liveLevel->rank}) [snapshot #{$snapshot->id}]");

                return $liveLevel;
            }
        }

        return null;
    }

    /**
     * First visible level with rank above the given rank (ordered ascending).
     */
    public function getNextVisibleLevel(int $companyId, int $currentRank): ?MlmLevel
    {
        return MlmLevel::where('company_id', $companyId)
            ->visible()
            ->where('rank', '>', $currentRank)
            ->ordered()
            ->with('criteria')
            ->first();
    }

    /**
     * Highest-rank visible level for a company.
     */
    public function getHighestVisibleLevel(int $companyId): ?MlmLevel
    {
        return MlmLevel::where('company_id', $companyId)
            ->visible()
            ->orderedDesc()
            ->first();
    }

    /**
     * Get the lowest-rank (entry/base) MLM level for a company.
     */
    public function getBaseLevel(?int $companyId = null): ?MlmLevel
    {
        $query = MlmLevel::ordered();

        if ($companyId) {
            $query->where('company_id', $companyId);
        }

        return $query->first();
    }

    /**
     * Assign the base (lowest-rank) MLM level to an agent if they don't already have one.
     *
     * @return bool Whether a level was assigned.
     */
    public function assignBaseLevel(LeadAgent $agent): bool
    {
        // Skip if agent already has a level
        if ($this->getCurrentLevel($agent) !== null) {
            return false;
        }

        $baseLevel = $this->getBaseLevel($agent->company_id);

        if (!$baseLevel) {
            Log::warning("LevelService: No base level found for company {$agent->company_id}. Cannot assign level to agent {$agent->id}.");
            return false;
        }

        $this->assignLevel($agent, $baseLevel, systemAssigned: true);

        Log::info("LevelService: Assigned base level '{$baseLevel->name}' (rank {$baseLevel->rank}) to agent {$agent->id}.");

        return true;
    }

    /**
     * Backfill base level for all agents that have no level assigned.
     *
     * @return int Number of agents updated.
     */
    public function backfillBaseLevelForAllAgents(?int $companyId = null): int
    {
        $query = LeadAgent::whereDoesntHave('levelHistory');

        if ($companyId) {
            $query->where('company_id', $companyId);
        }

        $agents = $query->get();
        $count = 0;

        foreach ($agents as $agent) {
            if ($this->assignBaseLevel($agent)) {
                $count++;
            }
        }

        return $count;
    }
}
