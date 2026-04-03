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
     * Uses the average of individual criterion percentages (matching dashboard).
     */
    public function getProgressPercentageAttribute(): float
    {
        $currentRank = $this->agent?->currentLevelHistory?->level?->rank ?? -1;
        $nextLevel = $this->resolveNextLevel($currentRank);

        if (!$nextLevel || $nextLevel->criteria->isEmpty()) {
            return 0;
        }

        $metricsSource = $this->metricsSourceOverride ?? $this;
        $totalPercentage = 0;
        $count = $nextLevel->criteria->count();

        foreach ($nextLevel->criteria as $criterion) {
            $currentValue = $criterion->metric->resolveValue($metricsSource);
            $targetValue = (float) $criterion->threshold;
            $met = $criterion->evaluate($metricsSource);
            $percentage = $targetValue > 0
                ? min(100, ($currentValue / $targetValue) * 100)
                : ($met ? 100 : 0);
            $totalPercentage += $percentage;
        }

        return $count > 0 ? round($totalPercentage / $count, 1) : 0;
    }

    /**
     * Per-criterion progress breakdown towards the next level.
     */
    public function getCriteriaProgressAttribute(): array
    {
        $currentRank = $this->agent?->currentLevelHistory?->level?->rank ?? -1;
        $nextLevel = $this->resolveNextLevel($currentRank);

        if (!$nextLevel || $nextLevel->criteria->isEmpty()) {
            return [];
        }

        $metricsSource = $this->metricsSourceOverride ?? $this;
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

    /**
     * Optional override for the metrics source used in progress calculations.
     * Set externally (e.g. by the controller) to use cycle metrics instead of all-time.
     */
    public ?object $metricsSourceOverride = null;

    // ── Internal Helpers ─────────────────────────────────────────

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
