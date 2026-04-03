<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Enums\EnrollmentStatus;
use Illuminate\Support\Collection;

class AgentMetric extends BaseModel
{
    use HasFactory, HasCompany;

    protected $table = 'agent_metrics';

    protected $fillable = [
        'company_id',
        'agent_id',
        'nsa',
        'nsd',
        'vsa',
        'vsd',
    ];

    protected $casts = [
        'nsa' => 'integer',
        'nsd' => 'integer',
        'vsa' => 'decimal:2',
        'vsd' => 'decimal:2',
    ];

    protected $appends = [
        'current_level',
        'next_level',
        'progress_percentage',
        'criteria_progress',
    ];

    // ── Relationships ────────────────────────────────────────────

    public function agent(): BelongsTo
    {
        return $this->belongsTo(LeadAgent::class, 'agent_id');
    }

    // ── Computed Accessors (Level Progress) ──────────────────────

    /**
     * The agent's current MLM level (via latest level history).
     */
    public function getCurrentLevelAttribute(): ?array
    {
        $level = $this->agent?->currentLevelHistory?->level;

        return $level?->toArray();
    }

    /**
     * The next level above the agent's current rank.
     */
    public function getNextLevelAttribute(): ?array
    {
        $currentRank = $this->agent?->currentLevelHistory?->level?->rank ?? -1;
        $nextLevel = $this->resolveNextLevel($currentRank);

        return $nextLevel?->toArray();
    }

    /**
     * Overall progress percentage towards the next level (0-100).
     * Uses cycle metrics when agent has an active enrollment, otherwise all-time.
     */
    public function getProgressPercentageAttribute(): float
    {
        $currentRank = $this->agent?->currentLevelHistory?->level?->rank ?? -1;
        $nextLevel = $this->resolveNextLevel($currentRank);

        if (!$nextLevel || $nextLevel->criteria->isEmpty()) {
            return 0;
        }

        $metricsSource = $this->resolveMetricsForEvaluation();

        $total = $nextLevel->criteria->count();
        $metCount = 0;

        foreach ($nextLevel->criteria as $criterion) {
            if ($criterion->evaluate($metricsSource)) {
                $metCount++;
            }
        }

        return $total > 0 ? round(($metCount / $total) * 100, 1) : 0;
    }

    /**
     * Per-criterion progress breakdown towards the next level.
     * Uses cycle metrics when agent has an active enrollment, otherwise all-time.
     */
    public function getCriteriaProgressAttribute(): array
    {
        $currentRank = $this->agent?->currentLevelHistory?->level?->rank ?? -1;
        $nextLevel = $this->resolveNextLevel($currentRank);

        if (!$nextLevel || $nextLevel->criteria->isEmpty()) {
            return [];
        }

        $metricsSource = $this->resolveMetricsForEvaluation();
        $progress = [];

        foreach ($nextLevel->criteria as $criterion) {
            $currentValue = $criterion->metric->resolveValue($metricsSource);
            $targetValue  = (float) $criterion->threshold;
            $met          = $criterion->evaluate($metricsSource);

            $progress[] = [
                'criterion'     => $criterion->toArray(),
                'current_value' => $currentValue,
                'target_value'  => $targetValue,
                'met'           => $met,
                'percentage'    => $targetValue > 0
                    ? min(100, round(($currentValue / $targetValue) * 100, 1))
                    : ($met ? 100 : 0),
            ];
        }

        return $progress;
    }

    // ── Internal Helpers ─────────────────────────────────────────

    /**
     * Resolve the metrics source for evaluation.
     * Prefers cycle metrics from the agent's active enrollment, falls back to all-time (this).
     */
    protected function resolveMetricsForEvaluation()
    {
        static $cycleMetricsCache = [];

        $agentId = $this->agent_id;

        if (!isset($cycleMetricsCache[$agentId])) {
            $cycleMetricsCache[$agentId] = false; // sentinel for "checked but not found"

            $enrollment = AgentCycleEnrollment::where('agent_id', $agentId)
                ->whereIn('status', [EnrollmentStatus::Active, EnrollmentStatus::Extended])
                ->with('metrics')
                ->latest('effective_start_date')
                ->first();

            if ($enrollment?->metrics) {
                $cycleMetricsCache[$agentId] = $enrollment->metrics;
            }
        }

        return $cycleMetricsCache[$agentId] ?: $this;
    }

    /**
     * Resolve the next level above the given rank.
     * Uses a shared static cache per-request to avoid repeated queries.
     */
    protected function resolveNextLevel(int $currentRank): ?MlmLevel
    {
        $levels = $this->getCompanyLevels();

        return $levels->first(fn (MlmLevel $l) => $l->rank > $currentRank);
    }

    /**
     * Get all company levels ordered by rank (cached per-request).
     */
    protected function getCompanyLevels(): Collection
    {
        static $cache = [];

        $companyId = $this->company_id;

        if (!isset($cache[$companyId])) {
            $cache[$companyId] = MlmLevel::where('company_id', $companyId)
                ->ordered()
                ->with('criteria')
                ->get();
        }

        return $cache[$companyId];
    }
}
