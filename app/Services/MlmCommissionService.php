<?php

namespace App\Services;

use App\Enums\MlmCommissionStatus;
use App\Enums\MlmCommissionType;
use App\Models\Deal;
use App\Models\LeadAgent;
use App\Models\MlmCommission;
use App\Models\MlmLevel;
use Illuminate\Support\Facades\Log;

class MlmCommissionService
{
    protected HierarchyService $hierarchyService;
    protected LevelService $levelService;

    public function __construct(HierarchyService $hierarchyService, LevelService $levelService)
    {
        $this->hierarchyService = $hierarchyService;
        $this->levelService = $levelService;
    }

    /**
     * Distribute commissions for a won deal using the Differential Commission Model.
     *
     * Commission flow:
     * 1. Agent receives their level's commission %
     * 2. Each ancestor receives (their_level% - previous_cumulative%)
     * 3. Remaining up to max_commission% goes to system
     *
     * @return array Summary of distributed commissions
     */
    public function distribute(Deal $deal): array
    {
        $agent = LeadAgent::find($deal->agent_id);

        if (!$agent) {
            Log::warning("MlmCommissionService: No agent found for deal {$deal->id}");
            return [];
        }

        $dealValue = (float) ($deal->total_value ?? $deal->value ?? 0);
        $maxCommission = $this->getMaxCommissionPercentage($deal);

        if ($dealValue <= 0 || $maxCommission <= 0) {
            Log::info("MlmCommissionService: Skipping deal {$deal->id} - zero value or max commission");
            return [];
        }

        $agentLevel = $this->levelService->getCurrentLevel($agent);
        $agentCommissionPct = $agentLevel ? (float) $agentLevel->commission_percentage : 0;

        $records = [];
        $cumulativePct = 0;

        // 1. Agent's own commission
        if ($agentCommissionPct > 0) {
            $effectivePct = min($agentCommissionPct, $maxCommission);
            $records[] = $this->createCommissionRecord(
                deal: $deal,
                agent: $agent,
                sourceAgent: $agent,
                level: $agentLevel,
                percentage: $effectivePct,
                amount: $this->calculateAmount($dealValue, $effectivePct),
                type: MlmCommissionType::Agent
            );
            $cumulativePct = $effectivePct;
        }

        // 2. Upline commissions (differential model)
        if ($cumulativePct < $maxCommission) {
            $ancestors = $this->hierarchyService->getAncestorsWithLevels($agent);

            foreach ($ancestors as $ancestor) {
                if ($cumulativePct >= $maxCommission) {
                    break;
                }

                $ancestorLevel = $ancestor->currentLevelHistory?->level;

                if (!$ancestorLevel) {
                    continue; // Ancestor has no level, skip
                }

                $ancestorPct = (float) $ancestorLevel->commission_percentage;

                // Differential: only pay if their level's % is higher than cumulative
                if ($ancestorPct > $cumulativePct) {
                    $differential = $ancestorPct - $cumulativePct;
                    $effectivePct = min($differential, $maxCommission - $cumulativePct);

                    if ($effectivePct > 0) {
                        $records[] = $this->createCommissionRecord(
                            deal: $deal,
                            agent: $ancestor,
                            sourceAgent: $agent,
                            level: $ancestorLevel,
                            percentage: $effectivePct,
                            amount: $this->calculateAmount($dealValue, $effectivePct),
                            type: MlmCommissionType::Upline
                        );
                        $cumulativePct += $effectivePct;
                    }
                }
            }
        }

        // 3. System commission (remaining %)
        $remainingPct = $maxCommission - $cumulativePct;

        if ($remainingPct > 0.001) { // Avoid floating point dust
            $records[] = $this->createCommissionRecord(
                deal: $deal,
                agent: $agent, // System entry attributed to the source agent
                sourceAgent: $agent,
                level: null,
                percentage: round($remainingPct, 2),
                amount: $this->calculateAmount($dealValue, $remainingPct),
                type: MlmCommissionType::System
            );
        }

        Log::info("MlmCommissionService: Distributed " . count($records) . " commission records for deal {$deal->id} (total {$cumulativePct}% of {$maxCommission}% max)");

        return $records;
    }

    /**
     * Revert all commissions for a deal.
     */
    public function revert(Deal $deal, string $reason): int
    {
        $count = MlmCommission::where('deal_id', $deal->id)
            ->where('status', MlmCommissionStatus::Pending->value)
            ->update([
                'status' => MlmCommissionStatus::Reverted->value,
                'reverted_at' => now(),
                'reverted_reason' => $reason,
            ]);

        Log::info("MlmCommissionService: Reverted {$count} commissions for deal {$deal->id}: {$reason}");

        return $count;
    }

    /**
     * Calculate the monetary amount from deal value and percentage.
     */
    protected function calculateAmount(float $dealValue, float $percentage): float
    {
        return round($dealValue * ($percentage / 100), 2);
    }

    /**
     * Get the max commission percentage for a deal.
     * Falls back to company config, then global config.
     */
    protected function getMaxCommissionPercentage(Deal $deal): float
    {
        // Per-deal override
        if ($deal->max_commission_percentage !== null && $deal->max_commission_percentage > 0) {
            return (float) $deal->max_commission_percentage;
        }

        // Fall back to config
        return (float) config('mlm.max_commission_percentage', 10);
    }

    /**
     * Create a commission record in the database.
     */
    protected function createCommissionRecord(
        Deal $deal,
        LeadAgent $agent,
        LeadAgent $sourceAgent,
        ?MlmLevel $level,
        float $percentage,
        float $amount,
        MlmCommissionType $type
    ): MlmCommission {
        return MlmCommission::create([
            'company_id' => $deal->company_id,
            'deal_id' => $deal->id,
            'agent_id' => $agent->id,
            'source_agent_id' => $sourceAgent->id,
            'level_id' => $level?->id,
            'percentage' => $percentage,
            'amount' => $amount,
            'type' => $type->value,
            'status' => MlmCommissionStatus::Pending->value,
        ]);
    }
}
