<?php

namespace App\Models;

use App\Enums\MlmMetric;
use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Collection;

class MlmCycleLevelSnapshot extends BaseModel
{
    use HasFactory, HasCompany;

    protected $table = 'mlm_cycle_level_snapshots';

    protected $fillable = [
        'company_id',
        'cycle_id',
        'source_level_id',
        'name',
        'slug',
        'rank',
        'commission_percentage',
    ];

    protected $casts = [
        'rank' => 'integer',
        'commission_percentage' => 'decimal:2',
    ];

    // ── Relationships ────────────────────────────────────────────

    public function cycle(): BelongsTo
    {
        return $this->belongsTo(MlmCycle::class, 'cycle_id');
    }

    public function sourceLevel(): BelongsTo
    {
        return $this->belongsTo(MlmLevel::class, 'source_level_id');
    }

    public function criteriaSnapshots(): HasMany
    {
        return $this->hasMany(MlmCycleCriteriaSnapshot::class, 'cycle_level_snapshot_id');
    }

    // ── Scopes ───────────────────────────────────────────────────

    public function scopeOrderedDesc($query)
    {
        return $query->orderBy('rank', 'desc');
    }

    public function scopeOrdered($query)
    {
        return $query->orderBy('rank', 'asc');
    }

    // ── Evaluation ───────────────────────────────────────────────

    /**
     * Evaluate all criteria snapshots for this level against the given metrics.
     *
     * Logic groups:
     * - Within the same logic_group: OR (any must pass)
     * - Between groups: AND (all groups must pass)
     */
    public function evaluateCriteria(object $metrics): bool
    {
        $criteria = $this->relationLoaded('criteriaSnapshots')
            ? $this->criteriaSnapshots
            : $this->criteriaSnapshots()->get();

        if ($criteria->isEmpty()) {
            return false;
        }

        $groups = $criteria->groupBy('logic_group');

        foreach ($groups as $groupCriteria) {
            $anyPassed = false;

            foreach ($groupCriteria as $criterion) {
                if ($criterion->evaluate($metrics)) {
                    $anyPassed = true;
                    break;
                }
            }

            if (!$anyPassed) {
                return false;
            }
        }

        return true;
    }
}
