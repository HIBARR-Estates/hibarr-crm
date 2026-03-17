<?php

namespace App\Models;

use App\Enums\MlmMetric;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MlmLevelCriterion extends BaseModel
{
    use HasFactory;

    protected $table = 'mlm_level_criteria';

    protected $fillable = [
        'mlm_level_id',
        'logic_group',
        'metric',
        'operator',
        'threshold',
    ];

    protected $casts = [
        'metric' => MlmMetric::class,
        'logic_group' => 'integer',
        'threshold' => 'decimal:2',
    ];

    // ── Relationships ────────────────────────────────────────────

    public function level(): BelongsTo
    {
        return $this->belongsTo(MlmLevel::class, 'mlm_level_id');
    }

    // ── Evaluation ───────────────────────────────────────────────

    /**
     * Evaluate this criterion against the given metrics.
     * Accepts both AgentMetric and AgentCycleMetric (both have nsa/nsd/vsa/vsd).
     */
    public function evaluate(object $metrics): bool
    {
        $value = $this->metric->resolveValue($metrics);

        return match ($this->operator) {
            '>='  => $value >= (float) $this->threshold,
            '>'   => $value > (float) $this->threshold,
            '<='  => $value <= (float) $this->threshold,
            '<'   => $value < (float) $this->threshold,
            '='   => $value == (float) $this->threshold,
            default => false,
        };
    }
}
