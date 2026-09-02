<?php

namespace App\Services;

use App\Enums\MlmCommissionStatus;
use App\Enums\MlmCommissionType;
use App\Enums\PackageCommissionType;
use App\Models\AgentPackageCommissionRate;
use App\Models\Deal;
use App\Models\LeadAgent;
use App\Models\MlmCommission;
use App\Models\MlmCycleLevelSnapshot;
use App\Models\MlmLevel;
use App\Models\Package;
use App\Support\FeatureFlags;
use Illuminate\Support\Facades\Log;

class MlmCommissionService
{
    protected HierarchyService $hierarchyService;

    protected LevelService $levelService;

    protected CycleService $cycleService;

    protected CycleLevelSnapshotService $snapshotService;

    public function __construct(
        HierarchyService $hierarchyService,
        LevelService $levelService,
        CycleService $cycleService,
        CycleLevelSnapshotService $snapshotService,
        protected MlmNotificationService $mlmNotifications,
    ) {
        $this->hierarchyService = $hierarchyService;
        $this->levelService = $levelService;
        $this->cycleService = $cycleService;
        $this->snapshotService = $snapshotService;
    }

    /**
     * Distribute commissions for a won deal using the Differential Commission Model.
     *
     * A persist loop over preview(), deliberately: the dashboard shows partners
     * a forecast of what their open referrals would pay, and a forecast
     * computed by a parallel implementation is a forecast that drifts. This one
     * is shown to people outside the company, so it has to be the same
     * arithmetic that later writes the money.
     *
     * @return array<int, MlmCommission> the persisted records
     */
    public function distribute(Deal $deal): array
    {
        $records = [];

        foreach ($this->preview($deal) as $leg) {
            $record = MlmCommission::create($leg);
            $records[] = $record;

            if (($leg['type'] ?? null) !== MlmCommissionType::System->value) {
                $this->mlmNotifications->afterCommit(
                    fn () => $this->mlmNotifications->notifyCommissionEarned($record->fresh())
                );
            }
        }

        return $records;
    }

    /**
     * The commission legs a deal would produce, without writing any of them.
     *
     * Commission flow:
     * 1. Agent receives their level's commission %
     * 2. Each ancestor receives (their_level% - previous_cumulative%)
     * 3. Remaining up to max_commission% goes to system
     *
     * @return array<int, array<string, mixed>>
     */
    public function preview(Deal $deal): array
    {
        $agent = LeadAgent::find($deal->agent_id);

        if (! $agent) {
            Log::warning("MlmCommissionService: No agent found for deal {$deal->id}");

            return [];
        }

        // A deal sold on a configured package pays from that package's own
        // settings and nothing else: no upline legs, no system leg.
        $packageLegs = $this->packageLegs($deal, $agent);

        if ($packageLegs !== null) {
            return $packageLegs;
        }

        $dealValue = (float) ($deal->value ?? 0);

        // Resolve cycle context for snapshot-aware distribution
        $enrollment = $this->cycleService->getActiveEnrollment($agent);
        $cycle = $enrollment?->cycle;
        $useSnapshots = $cycle && $cycle->hasSnapshots();

        $maxCommission = $this->getMaxCommissionPercentage($deal, $cycle);

        if ($dealValue <= 0 || $maxCommission <= 0) {
            Log::info("MlmCommissionService: Skipping deal {$deal->id} - zero value or max commission");

            return [];
        }

        // Resolve agent's commission percentage from snapshot or live level
        $agentLevel = $this->levelService->getCurrentLevel($agent);
        $agentSnapshotLevel = null;
        $agentCommissionPct = 0;

        if ($useSnapshots && $agentLevel) {
            $agentSnapshotLevel = $this->snapshotService->getSnapshotLevelBySourceId($cycle, $agentLevel->id);
            $agentCommissionPct = $this->isPerAgentOverrideEnabled()
                ? $this->resolveDirectRate($agent, $agentLevel, $agentSnapshotLevel)
                : ($agentSnapshotLevel
                    ? (float) $agentSnapshotLevel->commission_percentage
                    : (float) $agentLevel->commission_percentage);
        } elseif ($agentLevel) {
            $agentCommissionPct = $this->isPerAgentOverrideEnabled()
                ? $this->resolveDirectRate($agent, $agentLevel, null)
                : (float) $agentLevel->commission_percentage;
        }

        $records = [];
        $cumulativePct = 0;

        // 1. Agent's own commission
        if ($agentCommissionPct > 0) {
            $effectivePct = min($agentCommissionPct, $maxCommission);
            $records[] = $this->leg(
                deal: $deal,
                agent: $agent,
                sourceAgent: $agent,
                level: $agentLevel,
                percentage: $effectivePct,
                amount: $this->calculateAmount($dealValue, $effectivePct),
                type: MlmCommissionType::Agent,
                cycleLevelSnapshotId: $agentSnapshotLevel?->id
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

                if (! $ancestorLevel) {
                    continue;
                }

                // Resolve commission % from snapshot or live
                $ancestorSnapshotLevel = null;
                $ancestorPct = $this->isPerAgentOverrideEnabled()
                    ? $this->resolveOverrideRate($ancestor, $ancestorLevel, null)
                    : (float) $ancestorLevel->commission_percentage;

                if ($useSnapshots) {
                    $ancestorSnapshotLevel = $this->snapshotService->getSnapshotLevelBySourceId($cycle, $ancestorLevel->id);
                    if ($ancestorSnapshotLevel) {
                        $ancestorPct = $this->isPerAgentOverrideEnabled()
                            ? $this->resolveOverrideRate($ancestor, $ancestorLevel, $ancestorSnapshotLevel)
                            : (float) $ancestorSnapshotLevel->commission_percentage;
                    }
                }

                // Differential: only pay if their level's % is higher than cumulative
                if ($ancestorPct > $cumulativePct) {
                    $differential = $ancestorPct - $cumulativePct;
                    $effectivePct = min($differential, $maxCommission - $cumulativePct);

                    if ($effectivePct > 0) {
                        $records[] = $this->leg(
                            deal: $deal,
                            agent: $ancestor,
                            sourceAgent: $agent,
                            level: $ancestorLevel,
                            percentage: $effectivePct,
                            amount: $this->calculateAmount($dealValue, $effectivePct),
                            type: MlmCommissionType::Upline,
                            cycleLevelSnapshotId: $ancestorSnapshotLevel?->id
                        );
                        $cumulativePct += $effectivePct;
                    }
                }
            }
        }

        // 3. System commission (remaining %)
        $remainingPct = $maxCommission - $cumulativePct;

        if ($remainingPct > 0.001) {
            $records[] = $this->leg(
                deal: $deal,
                agent: $agent,
                sourceAgent: $agent,
                level: null,
                percentage: round($remainingPct, 2),
                amount: $this->calculateAmount($dealValue, $remainingPct),
                type: MlmCommissionType::System
            );
        }

        Log::info('MlmCommissionService: Resolved '.count($records)." commission legs for deal {$deal->id} (total {$cumulativePct}% of {$maxCommission}% max)".($useSnapshots ? ' [snapshot]' : ''));

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
     * The legs a package-based deal produces, or null when this is not one.
     *
     * Package mode is decided by *configuration*, not by output: if any attached
     * package carries a commission_type, the package settings own the whole
     * distribution and an empty array is a legitimate answer. Deciding on
     * whether legs came out instead would mean a package deliberately set to
     * zero silently paid the full agent+upline+system split.
     *
     * @return array<int, array<string, mixed>>|null null = not a package deal, fall through
     */
    protected function packageLegs(Deal $deal, LeadAgent $agent): ?array
    {
        $packages = $deal->packages->filter(
            fn (Package $package) => $package->commission_type !== null
        );

        if ($packages->isEmpty()) {
            return null;
        }

        $overrides = AgentPackageCommissionRate::query()
            ->where('agent_id', $agent->id)
            ->whereIn('package_id', $packages->pluck('id'))
            ->get()
            ->keyBy('package_id');

        $legs = [];

        foreach ($packages as $package) {
            $resolved = $this->resolvePackageCommission($package, $agent, $overrides->get($package->id));

            if ($resolved === null) {
                continue;
            }

            $legs[] = $this->leg(
                deal: $deal,
                agent: $agent,
                sourceAgent: $agent,
                // Not earned via a level, so nothing is claimed about one.
                level: null,
                percentage: $resolved['percentage'],
                amount: $resolved['amount'],
                type: MlmCommissionType::Agent,
                packageId: $package->id,
            );
        }

        Log::info('MlmCommissionService: Resolved '.count($legs)." package commission legs for deal {$deal->id}");

        return $legs;
    }

    /**
     * What one package pays this agent: the per-agent override if there is one,
     * otherwise the package default.
     *
     * The percentage comes back alongside the amount because a fixed fee has no
     * percentage at all, and the leg has to record that difference rather than
     * store a derived figure that stops being true when the package is repriced.
     *
     * @return array{amount: float, percentage: float|null}|null null when nothing is payable
     */
    public function resolvePackageCommission(
        Package $package,
        LeadAgent $agent,
        ?AgentPackageCommissionRate $override = null
    ): ?array {
        $override ??= AgentPackageCommissionRate::query()
            ->where('agent_id', $agent->id)
            ->where('package_id', $package->id)
            ->first();

        $type = $override?->commission_type ?? $package->commission_type;
        $value = (float) ($override?->commission_value ?? $package->commission_value);

        if ($type === null) {
            return null;
        }

        $amount = $type === PackageCommissionType::Percentage
            ? round((float) $package->value * ($value / 100), 2)
            : round($value, 2);

        if ($amount <= 0) {
            return null;
        }

        return [
            'amount' => $amount,
            'percentage' => $type === PackageCommissionType::Percentage ? $value : null,
        ];
    }

    /**
     * Calculate the monetary amount from deal value and percentage.
     */
    protected function calculateAmount(float $dealValue, float $percentage): float
    {
        return round($dealValue * ($percentage / 100), 2);
    }

    protected function isPerAgentOverrideEnabled(): bool
    {
        return FeatureFlags::enabled('sales.per-agent-commission-override');
    }

    protected function resolveDirectRate(
        LeadAgent $agent,
        ?MlmLevel $level,
        ?MlmCycleLevelSnapshot $snapshot
    ): float {
        if ($agent->custom_direct_rate !== null) {
            return (float) $agent->custom_direct_rate;
        }

        if ($snapshot) {
            return (float) ($snapshot->direct_rate ?? $snapshot->commission_percentage);
        }

        if ($level) {
            return (float) ($level->direct_rate ?? $level->commission_percentage);
        }

        return 0;
    }

    protected function resolveOverrideRate(
        LeadAgent $agent,
        ?MlmLevel $level,
        ?MlmCycleLevelSnapshot $snapshot
    ): float {
        if ($agent->custom_override_rate !== null) {
            return (float) $agent->custom_override_rate;
        }

        if ($snapshot) {
            return (float) ($snapshot->override_rate ?? $snapshot->commission_percentage);
        }

        if ($level) {
            return (float) ($level->override_rate ?? $level->commission_percentage);
        }

        return 0;
    }

    /**
     * Get the max commission percentage for a deal.
     * Uses cycle snapshot if available, then per-deal override, then global config.
     */
    protected function getMaxCommissionPercentage(Deal $deal, ?\App\Models\MlmCycle $cycle = null): float
    {
        // Per-deal override takes highest priority
        if ($deal->max_commission_percentage !== null && $deal->max_commission_percentage > 0) {
            return (float) $deal->max_commission_percentage;
        }

        // Use cycle snapshot if available
        if ($cycle && $cycle->max_commission_snapshot !== null) {
            return (float) $cycle->max_commission_snapshot;
        }

        // Fall back to config
        return (float) config('mlm.max_commission_percentage', 10);
    }

    /**
     * Describe one commission leg, without writing it.
     *
     * @return array<string, mixed>
     */
    protected function leg(
        Deal $deal,
        LeadAgent $agent,
        LeadAgent $sourceAgent,
        ?MlmLevel $level,
        ?float $percentage,
        float $amount,
        MlmCommissionType $type,
        ?int $cycleLevelSnapshotId = null,
        ?int $packageId = null
    ): array {
        return [
            'company_id' => $deal->company_id,
            'deal_id' => $deal->id,
            'agent_id' => $agent->id,
            'source_agent_id' => $sourceAgent->id,
            'level_id' => $level?->id,
            'package_id' => $packageId,
            'cycle_level_snapshot_id' => $cycleLevelSnapshotId,
            'percentage' => $percentage,
            'amount' => $amount,
            'type' => $type->value,
            'status' => MlmCommissionStatus::Pending->value,
        ];
    }
}
