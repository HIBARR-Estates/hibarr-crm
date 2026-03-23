<?php

namespace App\Models;

use App\Enums\MlmMetric;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MlmCycleCriteriaSnapshot extends BaseModel
{
    use HasFactory;

    protected $table = 'mlm_cycle_criteria_snapshots';

    protected $fillable = [
        'cycle_level_snapshot_id',
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

    public function levelSnapshot(): BelongsTo
    {
        return $this->belongsTo(MlmCycleLevelSnapshot::class, 'cycle_level_snapshot_id');
    }

    // ── Evaluation ───────────────────────────────────────────────

    /**
     * Evaluate this criterion snapshot against the given metrics.
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
