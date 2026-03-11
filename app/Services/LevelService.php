<?php

namespace App\Services;

use App\Models\AgentLevelHistory;
use App\Models\AgentMetric;
use App\Models\Deal;
use App\Models\LeadAgent;
use App\Models\MlmLevel;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;

class LevelService
{
    protected HierarchyService $hierarchyService;
    protected MetricsService $metricsService;

    public function __construct(HierarchyService $hierarchyService, MetricsService $metricsService)
    {
        $this->hierarchyService = $hierarchyService;
        $this->metricsService = $metricsService;
    }

    /**
     * Evaluate whether the agent qualifies for a new (higher) level.
     *
     * If the agent qualifies for a level higher than their current level,
     * a new AgentLevelHistory record is created.
     *
     * @return MlmLevel|null The newly assigned level, or null if no change.
     */
    public function evaluate(LeadAgent $agent, ?Deal $triggerDeal = null): ?MlmLevel
    {
        $metrics = $this->metricsService->getOrCreateMetrics($agent);
        $companyId = $agent->company_id;

        // Get all levels for the company, ordered by rank DESC (highest first)
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

            if ($this->evaluateCriteria($metrics, $level->criteria)) {
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
     */
    public function evaluateWithAncestors(LeadAgent $agent, ?Deal $triggerDeal = null): void
    {
        // Evaluate the agent first
        $this->evaluate($agent, $triggerDeal);

        // Evaluate all ancestors (their downline metrics changed)
        $ancestors = $this->hierarchyService->getAncestors($agent);

        foreach ($ancestors as $ancestor) {
            $this->evaluate($ancestor, $triggerDeal);
        }
    }

    /**
     * Evaluate criteria for a level against agent metrics.
     *
     * Logic groups:
     * - Conditions within the same logic_group are OR'd (any must pass)
     * - Different logic_groups are AND'd (all groups must pass)
     */
    public function evaluateCriteria(AgentMetric $metrics, Collection $criteria): bool
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
        bool $systemAssigned = false
    ): AgentLevelHistory {
        return AgentLevelHistory::create([
            'company_id' => $agent->company_id,
            'agent_id' => $agent->id,
            'level_id' => $level->id,
            'assigned_at' => now(),
            'assigned_by' => $assignedBy,
            'system_assigned' => $systemAssigned,
            'trigger_deal_id' => $deal?->id,
        ]);
    }
}
